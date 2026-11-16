/* 构建完全自包含的单文件版：商机管家-单文件版.html
   将 style.css、app.js、manifest、图标全部内联，只上传这一个文件即可在公网使用。
   运行: node scripts/build_single.js */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const b64 = f => fs.readFileSync(path.join(root, f)).toString('base64');

const html = read('index.html');
const css = read('style.css');
const js = read('app.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

/* 安全检查：内联脚本中不能出现 </script */
if(/<\/script/i.test(js)) throw new Error('app.js 包含 </script>，无法安全内联');
if(/<\/style/i.test(css)) throw new Error('style.css 包含 </style>，无法安全内联');

/* manifest 图标换成 data URI */
const icons = manifest.icons.map(ic => {
  const data = b64(ic.src);
  const mime = ic.type || (ic.src.endsWith('.png') ? 'image/png' : 'application/octet-stream');
  return Object.assign({}, ic, {src: 'data:' + mime + ';base64,' + data});
});
const inlineManifest = 'data:application/manifest+json;charset=utf-8,' +
  encodeURIComponent(JSON.stringify(Object.assign({}, manifest, {icons})));

const icon192 = 'data:image/png;base64,' + b64('icons/icon-192.png');

/* 注意：替换串中含 $ 特殊字符（如 app.js 里的 $、$$、$'），
   必须用函数形式返回，避免 replace 对 $ 做替换解析 */
const out = html
  .replace('<link rel="manifest" href="manifest.webmanifest">',
           () => '<link rel="manifest" href="' + inlineManifest + '">')
  .replace('<link rel="icon" href="icons/icon-192.png">',
           () => '<link rel="icon" href="' + icon192 + '">')
  .replace('<link rel="apple-touch-icon" href="icons/icon-192.png">',
           () => '<link rel="apple-touch-icon" href="' + icon192 + '">')
  .replace('<link rel="stylesheet" href="style.css">',
           () => '<style>\n' + css + '\n</style>')
  .replace('<script src="app.js"></script>',
           () => '<script>\n/* 单文件版构建标记 */\nwindow.__SINGLE_FILE__ = true;\n' + js + '\n</script>');

const target = path.join(root, '商机管家-单文件版.html');
fs.writeFileSync(target, out, 'utf8');
console.log('generated: ' + target);
console.log('size: ' + (Math.round(out.length / 1024)) + ' KB');

/* 同时输出 GitHub Pages 部署包（ASCII 文件名，避免中文文件名 URL 问题） */
const deployDir = path.join(root, 'deploy-github-pages');
fs.mkdirSync(deployDir, {recursive: true});
fs.writeFileSync(path.join(deployDir, 'index.html'), out, 'utf8');
console.log('generated: ' + path.join(deployDir, 'index.html'));
