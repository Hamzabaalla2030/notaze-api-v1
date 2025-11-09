const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { getApi } = require('./api');
const { downloadFile } = require('../utils/download');

async function downloadKuaishou(url, basePath = 'resultdownload_preniv') {
  const spinner = ora(' Fetching Kuaishou video data...').start();
  
  try {
    const response = await axios.get(`${getApi.kuaishou}${encodeURIComponent(url)}`, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36'
      }
    });
    const data = response.data;

    if (!data || !data.status) {
      spinner.fail(chalk.red(' Failed to fetch Kuaishou video data'));
      console.log(chalk.gray('   • The API returned an error or invalid response'));
      return;
    }
    if (!data.data) {
      spinner.fail(chalk.red(' Invalid video data received'));
      console.log(chalk.gray('   • The video may be private or unavailable'));
      return;
    }

    spinner.succeed(chalk.green(' Kuaishou video data fetched successfully!'));
    console.log('');
    console.log(chalk.cyan(' Video Information:'));
    if (data.data.title && data.data.title.trim()) {
      console.log(chalk.gray('   • ') + chalk.white(`Title: ${data.data.title}`));
    }
    console.log(chalk.gray('   • ') + chalk.white(`Has Video: ${data.data.hasVideo ? 'Yes' : 'No'}`));
    console.log(chalk.gray('   • ') + chalk.white(`Has Images: ${data.data.hasAtlas ? 'Yes' : 'No'}`));
    console.log('');

    const hasVideo = data.data.hasVideo && data.data.original && data.data.original.videoUrl;
    const hasImages = data.data.hasAtlas && data.data.original && data.data.original.atlas && data.data.original.atlas.length > 0;

    if (!hasVideo && !hasImages) {
      console.log(chalk.yellow(' No downloadable media found in this post.'));
      return;
    }

    const downloadChoices = [];
    
    if (hasVideo) {
      downloadChoices.push({
        name: ' Video (Original Quality)',
        value: { type: 'video', url: data.data.original.videoUrl }
      });
    }

    if (hasImages) {
      data.data.original.atlas.forEach((image, index) => {
        downloadChoices.push({
          name: ` Image ${index + 1}`,
          value: { type: 'image', url: image, index }
        });
      });
    }

    if (downloadChoices.length > 1) {
      downloadChoices.push({
        name: ' Download All',
        value: 'all'
      });
    }

    downloadChoices.push({
      name: chalk.gray(' Cancel'),
      value: 'cancel'
    });

    const { selectedDownload } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedDownload',
        message: 'Select media to download:',
        choices: downloadChoices
      }
    ]);

    if (selectedDownload === 'cancel') {
      console.log(chalk.yellow('\n Download cancelled.'));
      return;
    }

    if (selectedDownload === 'all') {
      let downloadIndex = 0;
      const totalItems = (hasVideo ? 1 : 0) + (hasImages ? data.data.original.atlas.length : 0);
      
      if (hasVideo) {
        downloadIndex++;
        const downloadSpinner = ora(` Downloading video (${downloadIndex}/${totalItems})...`).start();
        const filename = `kuaishou_video_${Date.now()}.mp4`;
        await downloadFile(data.data.original.videoUrl, filename, downloadSpinner, basePath);
      }
      
      if (hasImages) {
        for (let i = 0; i < data.data.original.atlas.length; i++) {
          downloadIndex++;
          const image = data.data.original.atlas[i];
          const downloadSpinner = ora(` Downloading image ${i + 1} (${downloadIndex}/${totalItems})...`).start();
          const filename = `kuaishou_image_${Date.now()}_${i}.jpg`;
          await downloadFile(image, filename, downloadSpinner, basePath);
        }
      }
    } else {
      const downloadSpinner = ora(' Downloading media...').start();
      if (selectedDownload.type === 'video') {
        const filename = `kuaishou_video_${Date.now()}.mp4`;
        await downloadFile(selectedDownload.url, filename, downloadSpinner, basePath);
      } else if (selectedDownload.type === 'image') {
        const filename = `kuaishou_image_${Date.now()}.jpg`;
        await downloadFile(selectedDownload.url, filename, downloadSpinner, basePath);
      }
    }
  } catch (error) {
    spinner.fail(chalk.red(' Error fetching Kuaishou video'));
    if (error.code === 'ECONNABORTED') {
      console.log(chalk.gray(' • Request timeout - please try again'));
    } else if (error.response) {
      console.log(chalk.gray(` • API Error: ${error.response.status}`));
    } else if (error.request) {
      console.log(chalk.gray(' • Network error - please check your connection'));
    } else {
      console.log(chalk.gray(` • ${error.message}`));
    }
  }
}

module.exports = { downloadKuaishou };
