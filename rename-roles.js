const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));

let totalReplaced = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // We use placeholders to avoid overlapping replacements
  content = content.replace(/SUPER_ADMIN/g, '__TMP_ADMIN__');
  content = content.replace(/ADMINISTRADOR/g, 'SECRETARIA');
  content = content.replace(/__TMP_ADMIN__/g, 'ADMINISTRADOR');

  // Also replace for strings that might be title cased (Administrador, Super Administrador)
  content = content.replace(/Super Administrador/g, '__TMP_ADMIN_TITLE__');
  content = content.replace(/Administrador/g, 'Secretaria');
  content = content.replace(/__TMP_ADMIN_TITLE__/g, 'Administrador');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    totalReplaced++;
    console.log('Replaced in:', file);
  }
});

console.log('Total files updated:', totalReplaced);
