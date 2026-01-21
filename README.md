# ProtonDrive-Rclone
A simple electron GUI for Proton Drive using a custom Rclone binary as a backend that works on Linux

## Disclaimer
This app is experimental and may not work as intended in specific situations. I'm not responsible on any damages or loss of data from the use of this app.
This app is not endorsed or officially supported by Proton.

## What works :
- [x] Login to proton (if login doesn't work configure the Rclone repo manually with the name "protondrive" [guide](https://rclone.org/protondrive/))
- [x] Sync of files
- [x] BiSync of files (can have issues)
- [x] Rclone Filters
- [x] Auto sync at interval and startup of the app
- [x] Change rclone transfer rate and checker rate
- [x] Background sync
- [x] **Custom Rclone binary** (automatically downloaded from [MiMillieuh/rclone](https://github.com/MiMillieuh/rclone/releases/tag/modified-v2))

## Requirements :
- None (the custom rclone binary is downloaded automatically at first launch)

## Installing :
Download the Appimage or zip from the [release](https://github.com/MiMillieuh/ProtonDrive-Rclone/releases)

## Building / Testing :

Clone the repo and run :
`npm install`

To start the app, run :
`npm start`

To build the app, run : 
`npm run make`

## Support my projects :
You can support me on [Amethyst Lab's Ko-Fi](https://ko-fi.com/amethystlab)