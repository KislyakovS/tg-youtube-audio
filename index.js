const ytdl = require('ytdl-core');
const TelegramBot = require('node-telegram-bot-api');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const { TELEGRAM_TOKEN } = process.env;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  const { text, chat: { id: chatId } } = msg;

  if (text === '/start') {
    bot.sendMessage(chatId, 'Hello!\nSend URL to the YouTube video.');
    return;
  }

  if (!ytdl.validateURL(text)) {
    bot.sendMessage(chatId, 'Please send a valid YouTube URL.');
    return;
  }

  const loadingMessage = await bot.sendMessage(chatId, 'Downloading audio...');

  try {
    const url = text;

    const info = await ytdl.getBasicInfo(url);
    const stream = ytdl(text, { filter: 'audioonly', quality: 'lowestaudio' });

    const { title, author: { name: performer }, thumbnails: [{ url: thumbnail }] } = info.videoDetails;
    const outputFilePath = path.resolve(__dirname, `${title}.mp3`);

    ffmpeg(stream)
      .audioBitrate(128)
      .save(outputFilePath)
      .on('end', async () => {
        await bot.sendAudio(chatId, fs.createReadStream(outputFilePath), { thumbnail, performer, title });
        fs.unlinkSync(outputFilePath);
        bot.deleteMessage(chatId, loadingMessage.message_id);
      })
      .on('error', (e) => {
        console.log(e);
        bot.sendMessage(chatId, 'Error downloading audio. Please try again.');
        bot.deleteMessage(chatId, loadingMessage.message_id);
      })
  } catch (e) {
    console.log(e);
    bot.deleteMessage(chatId, loadingMessage.message_id);
    bot.sendMessage(chatId, 'An error occurred. Please try again.');
  }
})
