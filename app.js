const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');

// Screen size
const PUPPETEER_VIEWPORT = {width: 1080, height: 1024};
const PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']

// Dump output dir
const DUMP_DIR = `${__dirname}/dump`

for (let arg of process.argv.splice(2)){
    console.log(arg);
    run(arg);
}

async function run(albumURL){
    let browser = null;

    try{
        // Create browser and page for scraping
        browser = await puppeteer.launch({args: PUPPETEER_ARGS});
        let page = await browser.newPage();

        let songURLs = await getSongURLsFromAlbumURL(page, albumURL);
        for (let songName in songURLs){
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
        let html = await getHtmlOfUrl(page, albumURL);
        let $ = cheerio.load(html);

        let rows = $('album-tracklist-row');
        for (let row of rows){
            let anchor = $(row).find('a')[0];
            let href = $(anchor).attr('href');
            
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
        let html = await getHtmlOfUrl(page, songURL);
        let $ = cheerio.load(html);

        let divs = $('div');
        for (let div of divs){
            if ($(div).attr('data-lyrics-container')){
                let lyrics = $(div).text().trim();
                return lyrics;
            }
        }
        
        throw new Error('getLyricsOfSongURL', 'Lyrics not found');
    }
    catch(err){
        throw new Error('getLyricsOfSongURL', err);
    }
}

async function dumpLyrics(songName, lyrics){
    try{
        let filepath = `${DUMP_DIR}/${songName}.lyrics`;
        
        fs.writeFileSync(filepath, lyrics, 'utf-8')
    }
    catch(err){
        throw new Error('dumpLyrics', err);
    }
}