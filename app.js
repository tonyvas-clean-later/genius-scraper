const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');

// Screen size
const PUPPETEER_VIEWPORT = {width: 1080, height: 1024};
const PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']

// Dump output dir
const DUMP_DIR = `${__dirname}/dump`

// Iterate over album URLs passed by CLI
for (let arg of process.argv.splice(2)){
    // Run script for each album
    run(arg);
}

async function run(albumURL){
    // Puppeteer browser
    let browser = null;

    try{
        console.log(`Downloading lyrics for songs in ${albumURL}`);

        // Create browser and page for scraping
        browser = await puppeteer.launch({args: PUPPETEER_ARGS});
        let page = await browser.newPage();

        // Get song URLs from album page
        let songURLs = await getSongURLsFromAlbumURL(page, albumURL);
        // Iterate over songs and save lyrics to file
        for (let songName in songURLs){
            console.log(`  Downloading lyrics for ${songName}`);
            let lyrics = await getLyricsOfSongURL(page, songURLs[songName]);
            dumpLyrics(songName, lyrics);
        }
    }
    catch(err){
        console.error(`Error: main: Failed to scrape`, err);
    }
    finally{
        // Close browser if it was opened
        if (browser){
            await browser.close();
        }
    }

}

async function getHtmlOfUrl(page, url){
    try{
        // Navigate in page
        await page.goto(url);
        await page.setViewport(PUPPETEER_VIEWPORT);

        // Download the html
        let html = await page.content();
        
        // Return html data
        return html;
    }
    catch(err){
        throw new Error('getHtmlOfUrl', err);
    }
}

async function getSongURLsFromAlbumURL(page, albumURL){
    try{
        let songURLs = {};

        // Download and load album page
        let html = await getHtmlOfUrl(page, albumURL);
        let $ = cheerio.load(html);

        // Get song row elements
        let rows = $('album-tracklist-row');
        for (let row of rows){
            // Find URL linking the song lyrics
            let anchor = $(row).find('a')[0];
            let href = $(anchor).attr('href');
            
            // Get the song name part from the link text
            let name = $(anchor).text().trim().split('\n')[0].trim();

            songURLs[name] = href;
        }
        
        return songURLs;
    }
    catch(err){
        throw new Error('getSongURLsFromAlbumURL', err);
    }
}

async function getLyricsOfSongURL(page, songURL){
    try{
        // Pull and load song lyrics page
        let html = await getHtmlOfUrl(page, songURL);
        let $ = cheerio.load(html);

        // Get all divs on page
        let divs = $('div');
        // Lyrics are sometimes split into multiple smaller blocks
        let blocks = [];

        for (let div of divs){
            // Find divs containing this attribute
            if ($(div).attr('data-lyrics-container')){
                // Replace <br> line breaks with newlines
                let oldHTML = $(div).html();
                let newHTML = oldHTML.replace(/<br\s?\/?>/gi, '\n');

                // Get viewable text from lyrics block
                let block = $(div).html(newHTML).text().trim();
                blocks.push(block);
            }
        }
        
        // Join blocks into one big lyrics
        return blocks.join('\n\n');
    }
    catch(err){
        throw new Error('getLyricsOfSongURL', err);
    }
}

async function dumpLyrics(songName, lyrics){
    try{
        // File name based on song name
        let filepath = `${DUMP_DIR}/${songName}.lyrics`;
        
        // Write the lyrics
        fs.writeFileSync(filepath, lyrics, 'utf-8')
    }
    catch(err){
        throw new Error('dumpLyrics', err);
    }
}