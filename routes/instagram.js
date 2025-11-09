const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { getApi, normalizer } = require('./api');
const { downloadFile, getFileExtension } = require('../utils/download');

async function downloadInstagram(url, basePath = 'resultdownload_preniv') {
  const spinner = ora(' Fetching Instagram media data...').start();
  
  try {
    const response = await axios.get(`${getApi.instagram}${encodeURIComponent(url)}`, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36'
      }
    });
    const rawData = response.data;

    if (!rawData || !rawData.status) {
      spinner.fail(chalk.red(' Failed to fetch Instagram media data'));
      console.log(chalk.gray('   • The API returned an error or invalid response'));
      return;
    }

    const data = normalizer.normalizeInstagram(rawData.data, 'primary');

    if (!data.media || data.media.length === 0) {
      spinner.fail(chalk.red(' Invalid media data received'));
      console.log(chalk.gray('   • The media may be private or unavailable'));
      return;
    }

    spinner.succeed(chalk.green(' Instagram media data fetched successfully!'));
    console.log('');
    console.log(chalk.cyan(' Media Information:'));
    console.log(chalk.gray('   • ') + chalk.white(`Found ${data.media.length} media file(s)`));
    console.log('');
    
    if (data.media.length === 1) {
      const media = data.media[0];
      const downloadSpinner = ora(' Downloading media...').start();
      const extension = getFileExtension(media.url, 'jpg');
      const filename = `instagram_media_${Date.now()}.${extension}`;
      await downloadFile(media.url, filename, downloadSpinner, basePath);
    } else {
      const downloadChoices = data.media.map((media, index) => {
        const ext = getFileExtension(media.url, 'jpg');
        return {
          name: ` Media ${index + 1} (${ext === 'mp4' ? 'Video' : 'Photo'})`,
          value: { url: media.url, thumbnail: media.thumbnail, index, ext }
        };
      });
      downloadChoices.push({
        name: ' Download All',
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
          message: 'Select download option:',
          choices: downloadChoices
        }
      ]);
      if (selectedDownload === 'cancel') {
        console.log(chalk.yellow('\n Download cancelled.'));
        return;
      }
      if (selectedDownload === 'all') {
        for (let i = 0; i < data.media.length; i++) {
          const media = data.media[i];
          const downloadSpinner = ora(` Downloading media ${i + 1}/${data.media.length}...`).start();
          const extension = getFileExtension(media.url, 'jpg');
          const filename = `instagram_media_${i + 1}_${Date.now()}.${extension}`;
          await downloadFile(media.url, filename, downloadSpinner, basePath);
        }
      } else {
        const downloadSpinner = ora(' Downloading selected media...').start();
        const extension = selectedDownload.ext || getFileExtension(selectedDownload.url, 'jpg');
        const filename = `instagram_media_${selectedDownload.index + 1}_${Date.now()}.${extension}`;
        await downloadFile(selectedDownload.url, filename, downloadSpinner, basePath);
      }
    }
  } catch (error) {
    spinner.fail(chalk.red(' Error fetching Instagram media'));
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

module.exports = { downloadInstagram };
