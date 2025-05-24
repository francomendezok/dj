import fs from 'fs';
import path from 'path';

// Target directory where all files will be moved - using WSL path
const targetDir = "/mnt/c/Users/PCFRANCO/Music/2025/faltantes";

// Function to ensure target directory exists
function ensureTargetDirectory() {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

// Function to process a missing folder
async function processMissingFolder(missingPath) {
  try {
    const files = fs.readdirSync(missingPath);
    
    for (const file of files) {
      const sourcePath = path.join(missingPath, file);
      const targetPath = path.join(targetDir, file);
      
      // If file already exists in target, append a number
      let finalPath = targetPath;
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        const ext = path.extname(file);
        const baseName = path.basename(file, ext);
        finalPath = path.join(targetDir, `${baseName}_${counter}${ext}`);
        counter++;
      }
      
      // Copy the file instead of moving it
      fs.copyFileSync(sourcePath, finalPath);
      // After successful copy, delete the original
      fs.unlinkSync(sourcePath);
      console.log(`✅ Moved: ${file} → ${finalPath}`);
    }
    
    // Remove the empty missing folder
    fs.rmdirSync(missingPath);
    console.log(`🗑️ Removed empty folder: ${missingPath}`);
  } catch (e) {
    console.error(`❌ Error processing folder ${missingPath}: ${e.message}`);
  }
}

// Function to search for missing folders recursively
async function findMissingFolders(directory) {
  try {
    const items = fs.readdirSync(directory);
    
    for (const item of items) {
      const fullPath = path.join(directory, item);
      
      if (fs.statSync(fullPath).isDirectory()) {
        if (item === 'missing') {
          // Process missing folder
          await processMissingFolder(fullPath);
        } else {
          // Search in subdirectories
          await findMissingFolders(fullPath);
        }
      }
    }
  } catch (e) {
    console.error(`❌ Error searching in ${directory}: ${e.message}`);
  }
}

// Main execution
async function main() {
  try {
    // Ensure target directory exists
    ensureTargetDirectory();
    
    // Start searching from music directory
    const musicDir = "/mnt/c/Users/PCFRANCO/Music";
    console.log(`🔍 Searching for "missing" folders in ${musicDir}...`);
    
    await findMissingFolders(musicDir);
    console.log('✨ Process completed!');
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

main();