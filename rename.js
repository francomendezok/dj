import fs from 'fs';
import path from 'path';
import * as mm from 'music-metadata';
import NodeID3 from 'node-id3';
import fetch from 'node-fetch';

// Obtener el argumento de línea de comandos
const musicFolder = "/mnt/d/Musica/descargas";

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
async function processFile(fullPath, missingFolder) {
  const file = path.basename(fullPath);
  const ext = path.extname(file).toLowerCase();

  if (!['.mp3'].includes(ext)) return;

  try {
    const metadata = await mm.parseFile(fullPath);
    const { title, year, album, performerInfo, picture } = metadata.common;
    let { artist } = metadata.common;
    const { bitrate } = metadata.format;

    // Verificar metadata y bitrate
    if (!artist || !title || !bitrate || bitrate < 320000) {
      const reason = !artist || !title ? 
        'falta de metadata' : 
        `calidad insuficiente (${Math.round(bitrate/1000)}kbps)`;
      
      if (!missingFolder) {
        missingFolder = path.join(path.dirname(fullPath), 'missing');
        if (!fs.existsSync(missingFolder)) {
          fs.mkdirSync(missingFolder);
        }
      }
      
      console.log(`⏭️ Moviendo a missing por ${reason}: ${file}`);
      const missingPath = path.join(missingFolder, file);
      fs.renameSync(fullPath, missingPath);
      return;
    }

    // Combinar artistas
    const artistList = [artist, ...(performerInfo || [])].join(', ').replace(/;/g, ', ').trim();

    const newName = `${artistList} - ${title.trim()}${ext}`;
    const newPath = path.join(path.dirname(fullPath), newName);

    // Manejo de portadas
    let imageBuffer = null;
    
    if (!picture?.length > 0) {
      // Si no tiene imagen, intentar descargar una de Deezer
      imageBuffer = await getCoverImageFromDeezer(artist, title);
      if (imageBuffer) {
        console.log(`🖼️ Imagen descargada con éxito: ${file}`);
      }
    }

    // Etiquetas básicas (sin imagen)
    const tags = {
      title: title.trim(),
      artist: artistList,
      album: album || 'Desconocido',
      year: year || ''
    };

    // Primero actualizar las etiquetas básicas
    NodeID3.update(tags, fullPath);

    // Si hay una nueva imagen para agregar, hacerlo en una operación separada
    if (!picture?.length && imageBuffer) {
      NodeID3.update({ image: imageBuffer }, fullPath);
    }

    // Renombrar archivo
    fs.renameSync(fullPath, newPath);
    console.log(`✅ Renombrado: ${file} → ${newName}`);
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
