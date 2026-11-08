// Radio's built-in stations: Kyle's stations, at their real FM numbers where they have one.
// radio.js reads this, and so does Kyle's desktop dashboard (it loads this file from the
// live site), so this is the one list to edit.
// Bump seed when the list changes: listeners' browsers then swap in the new built-in
// stations and keep the ones they added themselves.
window.RADIO_STATIONS = {
  seed: 2,
  list: [
    { name: 'Groove Salad', freq: 88.5, url: 'https://ice2.somafm.com/groovesalad-128-mp3' },
    { name: 'WGDR', freq: 91.1, url: 'https://wgdr.broadcasttool.stream/wgdr_128' },
    { name: 'Black Sheep', freq: 91.5, url: 'https://wool.broadcasttool.stream/stream' },
    { name: 'VPR Jazz', freq: 93.3, url: 'https://vprjazz.streamguys1.com/vprjazz64.aac' },
    { name: 'WDEV', freq: 96.1, url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WDEVFM.mp3' },
    { name: 'Royalton', freq: 96.5, url: 'https://royaltonradio.streamguys1.com/live' },
    { name: 'VPR Classical', freq: 99.3, url: 'https://vprclassical.streamguys1.com/vprclassical128.mp3' },
    { name: 'Classic Hits', freq: 101.7, url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WCVTFM.mp3' },
    { name: 'WXGR', freq: 103.5, url: 'https://sh.fl-us.audio-stream.com/proxy/seacoast?mp=/stream' },
    { name: 'BBC World Service', freq: 105.3, url: 'https://vprbbc.streamguys1.com/vprbbc24.mp3' },
    { name: 'VPR News', freq: 107.9, url: 'https://vpr.streamguys1.com/vpr96.mp3' },
  ]
};
