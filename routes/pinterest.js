const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { getApi } = require('./api');
const { downloadFile } = require('../utils/download');

async function downloadPinterest(url, basePath = 'resultdownload_preniv') {
  const spinner = ora(' Fetching Pinterest media data...').start();
  
  try {
    const response = await axios.get(`${getApi.pinterest}${encodeURIComponent(url)}`, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36'
      }
    });
    const data = response.data;

    if (!data || !data.status) {
      spinner.fail(chalk.red(' Failed to fetch Pinterest media data'));
      console.log(chalk.gray('   • The API returned an error or invalid response'));
      return;
    }
    if (!data.data || !data.data.media_urls || data.data.media_urls.length === 0) {
      spinner.fail(chalk.red(' Invalid media data received'));
      console.log(chalk.gray('   • The pin may be unavailable or deleted'));
      return;
    }

    spinner.succeed(chalk.green(' Pinterest media data fetched successfully!'));
    console.log('');
    console.log(chalk.cyan(' Pin Information:'));
    if (data.data.title && data.data.title.trim()) {
      console.log(chalk.gray('   • Title: ') + chalk.white(data.data.title));
    }
    if (data.data.description && data.data.description.trim()) {
      console.log(chalk.gray('   • Description: ') + chalk.white(data.data.description));
    }
    console.log(chalk.gray('   • Pin ID: ') + chalk.white(data.data.id));
    console.log(chalk.gray('   • Created: ') + chalk.white(data.data.created_at));
    
    const videos = data.data.media_urls.filter(m => m.type === 'video');
    const gifs = data.data.media_urls.filter(m => m.type === 'gif');
    const images = data.data.media_urls.filter(m => m.type === 'image');
    let mediaType = 'image';
    let primaryMedia = images;
    
    if (videos.length > 0) {
      mediaType = 'video';
      primaryMedia = videos;
      console.log(chalk.gray('   • Media Type: ') + chalk.white('Video'));
    } else if (gifs.length > 0) {
      mediaType = 'gif';
      primaryMedia = gifs;
      console.log(chalk.gray('   • Media Type: ') + chalk.white('GIF'));
    } else {
      console.log(chalk.gray('   • Media Type: ') + chalk.white('Image'));
      console.log(chalk.gray('   • Found ') + chalk.white(`${images.length}`) + chalk.gray(' quality option(s)'));
    }
    console.log('');

    if (mediaType === 'video' || mediaType === 'gif') {
      const bestMedia = primaryMedia[0];
      const downloadSpinner = ora(` Downloading ${mediaType}...`).start();
      const extension = mediaType === 'video' ? 'mp4' : 'gif';
      const filename = `pinterest_${data.data.id}.${extension}`;
      await downloadFile(bestMedia.url, filename, downloadSpinner, basePath);
    } else {
      if (images.length === 1) {
        const downloadSpinner = ora(' Downloading image...').start();
        const extension = images[0].url.includes('.gif') ? 'gif' : 'jpg';
        const filename = `pinterest_${data.data.id}.${extension}`;
        await downloadFile(images[0].url, filename, downloadSpinner, basePath);
      } else {
        const downloadChoices = images.map((media) => ({
          name: `  ${media.quality.charAt(0).toUpperCase() + media.quality.slice(1)} - ${media.size || media.width + 'x' + media.height}`,
          value: media
        }));
        downloadChoices.push({
          name: 'Download All Qualities',
          value: 'all'
        });
        downloadChoices.push({
          name: chalk.gray(' Cancel'),
          value: 'cancel'
        });

        const { selectedDownload } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedDownload',
            message: 'Select quality to download:',
            choices: downloadChoices
          }
        ]);

        if (selectedDownload === 'cancel') {
          console.log(chalk.yellow('\n Download cancelled.'));
          return;
        }

        if (selectedDownload === 'all') {
          for (let i = 0; i < images.length; i++) {
            const media = images[i];
            const downloadSpinner = ora(`  Downloading ${media.quality} quality (${i + 1}/${images.length})...`).start();
            const extension = media.url.includes('.gif') ? 'gif' : 'jpg';
            const filename = `pinterest_${data.data.id}_${media.quality}.${extension}`;
            await downloadFile(media.url, filename, downloadSpinner, basePath);
          }
        } else {
          const downloadSpinner = ora('  Downloading selected image...').start();
          const extension = selectedDownload.url.includes('.gif') ? 'gif' : 'jpg';
          const filename = `pinterest_${data.data.id}_${selectedDownload.quality}.${extension}`;
          await downloadFile(selectedDownload.url, filename, downloadSpinner, basePath);
        }
      }
    }
  } catch (error) {
    spinner.fail(chalk.red(' Error fetching Pinterest media'));
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

module.exports = { downloadPinterest };
