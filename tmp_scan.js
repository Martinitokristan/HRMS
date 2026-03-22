const fs = require('fs');
const path = require('path');

const dir = 'c:/xampp/htdocs/HRMSBOSHET/resources/js/components';

function getFiles(startDir, filesList = []) {
    const files = fs.readdirSync(startDir);
    for (const file of files) {
        const fullPath = path.join(startDir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getFiles(fullPath, filesList);
        } else if (fullPath.endsWith('.js')) {
            filesList.push(fullPath);
        }
    }
    return filesList;
}

const allFiles = getFiles(dir);

let lines = [];
lines.push('FILE NAME                ROLE        CATEGORY   REASON');
lines.push('──────────────────────────────────────────────────────────────────');

for (const file of allFiles) {
    const fileName = path.basename(file);
    const relativePath = path.relative(dir, file);
    const content = fs.readFileSync(file, 'utf8');
    
    let role = 'Admin';
    if (relativePath.includes('customer')) role = 'Customer';
    if (relativePath.includes('supplier')) role = 'Supplier';
    if (relativePath.includes('rider')) role = 'Rider';
    if (relativePath.includes('shared')) role = 'Shared';
    if (relativePath.includes('auth')) role = 'Auth';

    let isSkip = false;
    let isLive = false;
    let isContext = false;
    let isCache = false;
    let reason = '';

    if (role === 'Shared' || role === 'Auth' || fileName.includes('Settings') || fileName.includes('Profile') || fileName.includes('Form')) {
        isSkip = true;
        reason = role === 'Shared' ? 'Utility no own fetching' : 'Auth/Settings/Form page';
    } 
    
    if (!content.includes('axios.get(') && !content.includes('axios.get `')) {
        isSkip = true;
        reason = 'No axios.get calls';
    }

    if (!isSkip) {
        if (content.includes("'/categories'") || content.includes('"/categories"') || 
            content.includes("'/settings'") || content.includes("'/unit-types'") || 
            content.includes("'/suppliers'") || content.includes("'/supplier/categories'") || 
            content.includes("'/supplier/variant-values'") || content.includes('"/settings"')) {
            isContext = true;
        }

        if (fileName.includes('Cart') || fileName === 'CustomerOrder.js' || content.match(/checkout/i) || content.match(/checkout/i)) {
            isLive = true;
            reason = 'Checkout/Cart/Live order validation';
        } else {
            isCache = true;
            if (isContext) {
                reason = 'List + calls /settings or /categories ctx';
            } else {
                reason = 'Loads list data (table/grid)';
            }
        }
    }

    let category = 'SKIP';
    if (isSkip) category = 'SKIP';
    else if (isLive) category = 'LIVE';
    else if (isCache && isContext) category = 'CACHE+CTX';
    else if (isCache) category = 'CACHE';
    else if (isContext) category = 'CONTEXT';

    const paddedName = fileName.padEnd(24);
    const paddedRole = role.padEnd(11);
    const paddedCat = category.padEnd(10);
    lines.push(`${paddedName} ${paddedRole} ${paddedCat} ${reason}`);
}

console.log(lines.join('\n'));
