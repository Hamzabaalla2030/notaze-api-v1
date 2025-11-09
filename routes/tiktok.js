const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { getApi } = require('./api');
const { downloadFile } = require('../utils/download');

async function downloadTikTok(url, basePath = 'resultdownload_preniv') {
  const spinner = ora(' Fetching TikTok video data...').start();
  
  let data = null;
  let apiVersion;
  
  try {
    try {
      const response = await axios.get(`${getApi.tiktok}${encodeURIComponent(url)}`, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36'
        }
      });
      
      if (response.data && response.data.status && response.data.data && response.data.data.downloads) {
        data = response.data;
        apiVersion = 'default';
      } else {
        throw new Error('Invalid default response');
      }
    } catch (defaultError) {
      spinner.text = ' Fetching TikTok video data (v1 fallback)...';
      const response = await axios.get(`${getApi.tiktokV1}${encodeURIComponent(url)}`, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36'
        }
      });
      
      if (response.data && response.data.status && response.data.data && response.data.data.downloads) {
        data = response.data;
        apiVersion = 'v1';
      } else {
        throw new Error('Both default and v1 APIs failed');
      }
    }

    if (!data || !data.status) {
      spinner.fail(chalk.red(' Failed to fetch TikTok video data'));
      console.log(chalk.gray('   • The API returned an error or invalid response'));
      return;
    }

    spinner.succeed(chalk.green(` TikTok video data fetched successfully! (using ${apiVersion})`));
    console.log('');
    console.log(chalk.cyan(' Video Information:'));
    console.log(chalk.gray('   • ') + chalk.white(`Title: ${data.data.title || 'No title'}`));
    if (data.data.description) {
      console.log(chalk.gray('   • ') + chalk.white(`Description: ${data.data.description}`));
    }
    if (data.data.creator) {
      console.log(chalk.gray('   • ') + chalk.white(`Creator: ${data.data.creator}`));
    }
    console.log('');

    const downloadChoices = data.data.downloads.map((item, index) => ({
      name: ` ${item.text}`,
      value: { url: item.url, text: item.text, index }
    }));
    
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
    
    const downloadSpinner = ora(` Downloading ${selectedDownload.text}...`).start();
    const extension = selectedDownload.text.toLowerCase().includes('mp3') ? 'mp3' : 'mp4';
    const filename = `tiktok_${Date.now()}.${extension}`;
    await downloadFile(selectedDownload.url, filename, downloadSpinner, basePath);
  } catch (error) {
    spinner.fail(chalk.red(' Error fetching TikTok video'));
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

module.exports = { downloadTikTok };
