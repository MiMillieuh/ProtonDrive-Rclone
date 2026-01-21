const fs = require('fs');
const path = require('path');
const https = require('https');
const url = 'https://github.com/MiMillieuh/rclone/releases/download/modified-v2/rclone-modified';

function downloadRclone() {
  const binDir = path.join(__dirname, 'bin');
  const binPath = path.join(binDir, 'rclone-modified');

  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir);
  }

  if (!fs.existsSync(binPath)) {
    console.log('Téléchargement de rclone-modified...');
    https.get(url, (res) => {
      const fileStream = fs.createWriteStream(binPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        fs.chmodSync(binPath, '755'); // Rendre exécutable
        console.log('rclone-modified téléchargé et prêt à l\'emploi.');
      });
    }).on('error', (err) => {
      console.error('Erreur lors du téléchargement :', err);
    });
  } else {
    console.log('rclone-modified est déjà présent.');
  }
}

module.exports = { downloadRclone };