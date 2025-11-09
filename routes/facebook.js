const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { getApi, normalizer } = require('./api');
const { downloadFile, getFileExtension } = require('../utils/download');

async function downloadFacebook(url, basePath = 'resultdownload_preniv') {
  const spinner = ora(' Fetching Facebook video data...').start();
  
  try {
    const response = await axios.get(`${getApi.facebook}${encodeURIComponent(url)}`, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36'
      }
    });
    const rawData = response.data;

    if (!rawData || !rawData.status) {
      spinner.fail(chalk.red(' Failed to fetch Facebook media data'));
      console.log(chalk.gray('   • The API returned an error or invalid response'));
      return;
    }

    const data = normalizer.normalizeFacebook(rawData.data, 'primary');

    if (!data.downloads || data.downloads.length === 0) {
      spinner.fail(chalk.red(' Invalid media data received'));
      console.log(chalk.gray('   • The media may be private or unavailable'));
      return;
    }

    spinner.succeed(chalk.green(' Facebook media data fetched successfully!'));
    console.log('');
    console.log(chalk.cyan(' Media Information:'));
    console.log(chalk.gray('   • ') + chalk.white(`Found ${data.downloads.length} quality option(s)`));
    console.log('');

    const downloadChoices = data.downloads.map((item, index) => {
      const ext = getFileExtension(item.url);
      return {
        name: ` ${item.resolution || item.quality} - ${ext.toUpperCase()}`,
        value: { url: item.url, resolution: item.resolution || item.quality, ext, index }
      };
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

    const downloadSpinner = ora(` Downloading ${selectedDownload.resolution}...`).start();
    const safeResolution = selectedDownload.resolution.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `facebook_${safeResolution}_${Date.now()}.${selectedDownload.ext}`;
    await downloadFile(selectedDownload.url, filename, downloadSpinner, basePath);
  } catch (error) {
    spinner.fail(chalk.red(' Error fetching Facebook video'));
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

module.exports = { downloadFacebook };
