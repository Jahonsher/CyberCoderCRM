const cron = require('node-cron');

function start() {
  cron.schedule('0 3 * * *', async () => {
    console.log('⏰ Kunlik reset cron bajarildi');
  }, {
    scheduled: true,
    timezone: 'Asia/Tashkent',
  });
  
  console.log('⏰ Kunlik Reset Cron faol: har kuni 03:00 (Asia/Tashkent)');
}

module.exports = { start };
