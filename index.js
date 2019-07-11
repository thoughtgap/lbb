#!/usr/bin/env node

const fs = require('fs');
const Nightmare = require('nightmare');

require('nightmare-download-manager')(Nightmare);

if (!process.env.ACCOUNT_LOGIN) {
  console.log("env ACCOUNT_LOGIN not set");
  process.exit(1);
}

if (!process.env.ACCOUNT_PASSWORD) {
  console.log("env ACCOUNT_PASSWORD not set");
  process.exit(1);
}

var downloadDir = '.';

if (process.argv[2]) {
  downloadDir = process.argv[2];
}

try {
  downloadDir = fs.realpathSync(downloadDir);
  fs.accessSync(downloadDir, fs.F_OK);
} catch (e) {
  console.log(`directory '${downloadDir} is not a directory or not writeable. exiting.`);
  process.exit(1);
}

console.log(`will download invoices to: ${downloadDir}`);

nightmare = Nightmare({
  show: !!process.env.DEBUG,
  paths: {
    downloads: downloadDir
  }
});

nightmare.on('download', function(state, downloadItem){
  if (state == 'started') {
    console.log(`downloading invoice ${downloadItem['filename']}`);
    nightmare.emit('download', downloadItem);
  }
})

nightmare
  .downloadManager()
  .goto('https://kreditkarten-banking.lbb.de/lbb/')
  .type('input[name=user]',     process.env.ACCOUNT_LOGIN)
  .type('input[name=password]', process.env.ACCOUNT_PASSWORD)
  .click('input[name=bt_LOGON]')
  .wait('a.haupt[id="nav.stmt"]')   // Wait for "Rechnungen" in Navbar
  .click('a.haupt[id="nav.stmt"]')  // Click "Rechnungen"
  .wait('input[name=bt_STMT]')      // Wait for the list
  .evaluate(function () {
    // Collect all the Statement-Links
    return Array.from(document.querySelectorAll('input[name=bt_STMT]'))
      .map(e => e.getAttribute('value'));
  })
  .then((dates) => {
    // Go into each statement and download PDF
    dates.forEach(function(date) {
      let downloadCsvSelector = '#bill_detail > tbody > tr > td.daten > table:nth-child(2) > tbody > tr:nth-child(7) > td > a';      
      
      nightmare
        .click('input[name="bt_STMT"][value="' + date + '"]')  // Click the date
        
        // Download the PDF
        .wait('input[name="bt_STMTPDF"]')   // Wait for the "PDF"-image
        .click('input[name="bt_STMTPDF"]')  // Click on it
        .waitDownloadsComplete()

        // Download the CSV
        .wait('input[name="bt_STMTSAVE"]')  // Wait for the "Rechnung speichern" button
        .click('input[name="bt_STMTSAVE"]') // Click on it
        .wait(downloadCsvSelector)          // Wait for the "Rechnung speichern als csv" button
        .click(downloadCsvSelector)         // Click on it
        .waitDownloadsComplete()

        // Go back to "Statements" in the Navbar
        .click('a.haupt[id="nav.stmt"]')
    });
    nightmare.waitDownloadsComplete();
    return nightmare.end();
  })
  .catch(function (error) {
    console.error('failed:', error);
  });
