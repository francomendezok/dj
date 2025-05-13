import fs from 'fs';
import path from 'path';
import * as mm from 'music-metadata';
import NodeID3 from 'node-id3';

// Base directory to process
const musicFolder = "/mnt/d/Musica/faltantes";

// Function to ensure the "done" directory exists
function ensureDoneDirectory(baseDir) {
  const doneDir = path.join(baseDir, 'done');
  if (!fs.existsSync(doneDir)) {
    fs.mkdirSync(doneDir, { recursive: true });
  }
  return doneDir;
}

// Function to process a single file
async function processFile(fullPath, doneDir) {
  const file = path.basename(fullPath);
  const ext = path.extname(file).toLowerCase();

  if (ext !== '.mp3') return;

  try {
    // Check bitrate first
    const metadata = await mm.parseFile(fullPath);
    const { bitrate } = metadata.format;

    if (!bitrate || bitrate < 320000) {
      console.log(`⏭️ Skipping (low bitrate ${Math.round(bitrate/1000)}kbps): ${file}`);
      return;
    }

    // Split filename at first "-"
    const nameWithoutExt = path.basename(file, ext);
    const splitIndex = nameWithoutExt.indexOf('-');
    
    if (splitIndex === -1) {
      console.log(`⏭️ Skipping (no artist-title separator): ${file}`);
      return;
    }

    const artist = nameWithoutExt.substring(0, splitIndex).trim() || "";
    const title = nameWithoutExt.substring(splitIndex + 1).trim() || "";

    // Update metadata
    const tags = {
      title: title,
      artist: artist,
      album: metadata.common.album || 'Unknown',
      year: metadata.common.year || ''
    };

    // Move to done folder with original name
    const targetPath = path.join(doneDir, file);
    
    // Copy file to done folder and remove original
    fs.copyFileSync(fullPath, targetPath);
    fs.unlinkSync(fullPath);
    
    // Update metadata in the new location
    NodeID3.update(tags, targetPath);
    
    console.log(`✅ Processed and moved: ${file}`);
    console.log(`   Artist: ${artist}`);
    console.log(`   Title: ${title}`);

  } catch (e) {
    console.error(`❌ Error processing ${file}: ${e.message}`);
  }
}

// Function to process directory recursively
async function processDirectory(directory) {
  const doneDir = ensureDoneDirectory(directory);
  const items = fs.readdirSync(directory);

  for (const item of items) {
    const fullPath = path.join(directory, item);
    
    // Skip the done folder
    if (item === 'done') continue;

    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Process subdirectory
      await processDirectory(fullPath);
    } else {
      // Process file
      await processFile(fullPath, doneDir);
    }
  }
}

// Start processing
console.log('🔍 Starting metadata processing...');
processDirectory(musicFolder).then(() => {
  console.log('✨ Process completed!');
}).catch(err => {
  console.error('❌ Error:', err);
});