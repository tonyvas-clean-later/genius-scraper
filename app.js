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
        // await scrollPage(page);

        // Download the html
        let html = await page.content();
        
        // Return html data
        return html;
    }
    catch(err){
        throw new Error('getHtmlOfUrl', err);
    }
}

async function scrollPage(page){
    try{
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                const SCROLL_DISTANCE = 50;
                const SCROLL_INTERVAL = 100;

                let scrolled = 0;

                let handle = setInterval(() => {
                    window.scrollBy(0, SCROLL_DISTANCE);
                    scrolled += SCROLL_DISTANCE;

                    if (scrolled >= document.body.scrollHeight - window.innerHeight){
                        clearInterval(handle);
                        resolve();
                    }
                }, SCROLL_INTERVAL);
            })
        })
    }
    catch(err){
        throw new Error('scrollPage', err);
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
        let blocks = [];
        for (let div of divs){
            if ($(div).attr('data-lyrics-container')){
                let oldHTML = $(div).html();
                let newHTML = oldHTML.replace(/<br\s?\/?>/gi, '\n');

                let block = $(div).html(newHTML).text().trim();
                blocks.push(block);
            }
        }
        
        return blocks.join('\n\n');
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