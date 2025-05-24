import fs from 'fs';
import path from 'path';
import * as mm from 'music-metadata';
import NodeID3 from 'node-id3';
import fetch from 'node-fetch';

// Obtener el argumento de línea de comandos
const musicFolder = "/mnt/c/Users/PCFRANCO/Music/2025/batea";

// Función para obtener imagen de Deezer
async function getCoverImageFromDeezer(artist, title) {
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
    console.warn(`⚠️ No se pudo descargar la portada: ${artist} - ${title} → ${e.message}`);
  }
  return null;
}

// Función para procesar un archivo
// Function to convert text to proper case
function toProperCase(text) {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function processFile(fullPath, missingFolder) {
  const file = path.basename(fullPath);
  const ext = path.extname(file).toLowerCase();

  if (!['.mp3'].includes(ext)) return;

  try {
    // Extract artist and title from filename
    const nameWithoutExt = path.basename(file, ext);
    // Remove BPM prefix and get the actual name
    const cleanName = nameWithoutExt.replace(/^\d+\s*BPM\s*/, '').trim();
    const splitIndex = cleanName.indexOf('-');
    
    if (splitIndex === -1) {
      console.log(`⏭️ Skipping (no artist-title separator): ${file}`);
      return;
    }

    const artist = toProperCase(cleanName.substring(0, splitIndex).trim());
    const title = toProperCase(cleanName.substring(splitIndex + 1).trim());

    // Update metadata
    const tags = {
      title: title,
      artist: artist,
      album: 'Unknown',
      year: ''
    };

    // Update metadata first
    NodeID3.update(tags, fullPath);

    // Try to get cover art from Deezer
    const imageBuffer = await getCoverImageFromDeezer(artist, title);
    if (imageBuffer) {
      NodeID3.update({ image: imageBuffer }, fullPath);
      console.log(`🖼️ Imagen descargada con éxito: ${file}`);
    }

    // Rename the file with proper case
    const newName = `${artist} - ${title}${ext}`;
    const newPath = path.join(path.dirname(fullPath), newName);
    fs.renameSync(fullPath, newPath);
    
    console.log(`✅ Procesado: ${file} → ${newName}`);
    console.log(`   Artista: ${artist}`);
    console.log(`   Título: ${title}`);

  } catch (e) {
    console.error(`❌ Error en ${file}: ${e.message}`);
  }
}

// Función recursiva para procesar directorios
async function processDirectory(directory) {
  const items = fs.readdirSync(directory);
  let missingFolder = null;

  for (const item of items) {
    const fullPath = path.join(directory, item);
    
    // Ignorar la carpeta missing
    if (item === 'missing') continue;

    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Procesar subdirectorio recursivamente
      await processDirectory(fullPath);
    } else {
      // Verificar si es un archivo MP3 que necesita ser movido a missing
      if (path.extname(item).toLowerCase() === '.mp3') {
        try {
          const metadata = await mm.parseFile(fullPath);
          const { title } = metadata.common;
          let { artist } = metadata.common;
          const { bitrate } = metadata.format;

          // Si el archivo necesita ir a missing, crear la carpeta si no existe
          if (!artist || !title || !bitrate || bitrate < 320000) {
            if (!missingFolder) {
              missingFolder = path.join(directory, 'missing');
              if (!fs.existsSync(missingFolder)) {
                fs.mkdirSync(missingFolder);
              }
            }
            await processFile(fullPath, missingFolder);
          } else {
            // Si el archivo es válido, procesarlo normalmente
            await processFile(fullPath, path.join(directory, 'missing'));
          }
        } catch (e) {
          console.error(`❌ Error analizando ${item}: ${e.message}`);
        }
      }
    }
  }
}

// Iniciar el procesamiento
processDirectory(musicFolder).catch(err => {
  console.error('❌ Error procesando directorio:', err);
});
