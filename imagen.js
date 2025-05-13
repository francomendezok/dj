import fs from 'fs';
import path from 'path';
import * as mm from 'music-metadata';
import NodeID3 from 'node-id3';
import fetch from 'node-fetch';

// Folder to process
const musicFolder = "/mnt/d/Musica/img";

// Function to get cover from Deezer
async function getCoverFromDeezer(artist, title) {
  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const searchUrl = `https://api.deezer.com/search?q=${query}&limit=1`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.data?.[0]?.album?.cover_xl) {
      const imageUrl = data.data[0].album.cover_xl;
      const imageResponse = await fetch(imageUrl);
      if (imageResponse.ok) {
        return await imageResponse.buffer();
      }
    }
  } catch (e) {
    console.warn(`⚠️ Deezer image download failed for: ${artist} - ${title} → ${e.message}`);
  }
  return null;
}

// Process a single file
async function processFile(fullPath) {
  const file = path.basename(fullPath);
  const ext = path.extname(file).toLowerCase();
  
  if (ext !== '.mp3') return;
  
  try {
    const metadata = await mm.parseFile(fullPath);
    const { title } = metadata.common;
    let { artist } = metadata.common;
    
    if (!artist || !title) {
      console.log(`⏭️ Skipping (missing metadata): ${file}`);
      return;
    }
    
    // Get image from Deezer
    const imageBuffer = await getCoverFromDeezer(artist, title);
    
    if (imageBuffer) {
      // Update only the image tag
      NodeID3.update({ image: imageBuffer }, fullPath);
      console.log(`✅ Updated cover art: ${file}`);
    } else {
      console.log(`❌ No cover found: ${file}`);
    }
    
  } catch (e) {
    console.error(`❌ Error processing ${file}: ${e.message}`);
  }
}

// Process directory recursively
async function processDirectory(directory) {
  const items = fs.readdirSync(directory);
  
  for (const item of items) {
    const fullPath = path.join(directory, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      await processDirectory(fullPath);
    } else {
      await processFile(fullPath);
    }
  }
}

// Start processing
processDirectory(musicFolder).catch(err => {
  console.error('❌ Error processing directory:', err);
});