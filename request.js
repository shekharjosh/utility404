const BATCH_SIZE = 5,
    DELAY = 5000;

let https = require('https'),
    fs = require('fs'),
    flow = require('xml-flow'),
    puppeteer = require('puppeteer'),
    inputUrl = process.argv[2] || process.exit(-1),
    fileSize = process.argv[3] || 100000,
    viewportWidth = process.argv[4] || 1300,
    viewportHeight = process.argv[5] || 767,
    waitUntil = process.argv[6] || 'networkidle2';

fs.unlink('sitemap.xml', (error) => {
    if (error) console.log('')
});
fs.unlink('statusFile.txt', (error) => {
    if (error) console.log('')
});
fs.unlink('imageFile.csv', (error) => {
    if (error) console.log('')
});

let splitIntoSubArray = (arr, count = BATCH_SIZE) => {
    var newArray = [];
    while (arr.length > 0) {
        newArray.push(arr.splice(0, count));
    }
    return newArray;
}

let delay = (time, data) => new Promise(resolve => {
    setTimeout(resolve.bind(null, data), time);
});

https.get(inputUrl, res => {
    let siteMapFile = fs.createWriteStream('sitemap.xml'),
        array = [];
    res.on('data', xmlData => {
        siteMapFile.write(xmlData);
    }).on('end', () => {
        siteMapFile.end();
        siteMapFile = fs.createReadStream('sitemap.xml');
        flow(siteMapFile).on('tag:loc', url => {
            array.push(url.$text);
        }).on('end', async () => {
            runBatchCapture(array).then(() => {
                console.log('>>>>> All pages captured.');
            }).catch(error => {
                console.error('>>>>> Error Occurred - ' + error);
            });
        });
    });
});

let runBatchCapture = async (array) => {
    let newArray = splitIntoSubArray(array),
        index = 0,
        next = () => {
            if (index < newArray.length) {
                return crawlPages(newArray[index++]).then(async function () {
                    return delay(DELAY).then(next);
                });
            }
        }
    return Promise.resolve().then(next);
}

let crawlPages = async (array) => {
    try {
        let statusTypeSet = new Set(),
            imageTypeSet = new Set(),
            browser = await puppeteer.launch(),
            urlRead = array.map(async (url) => {
                let page = await browser.newPage(),
                    pageContent;

                //Chrome on Windows v73
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36');
                    
                page.setViewport({
                    width: viewportWidth,
                    height: viewportHeight
                });
                process.on("unhandledRejection", (reason, promise) => {
                    console.error("Unhandled Rejection at: Promise", promise, "reason:", reason);
                    browser.close();
                });
                await page.setRequestInterception(true);
                page.on('request', request => {
                    request.continue();
                });
                page.on('response', response => {
                    if (response.status() === 404) {
                        statusTypeSet.add(`\n ${response.url()}, ${url}`);
                    }
                    if (response.request().resourceType() === 'image') {
                        try {
                            var contentLength =  response.headers()['content-length'];
                            if (contentLength > fileSize) {
                                imageTypeSet.add(`\n${contentLength / 1024 + ' KB'}, ${response.url()}, ${url}`);
                            }
                        } catch(e) {
                            console.log('>>>>> Error Occurred - ' + error);
                        }
                    }
                });
                //await page.authenticate({username:"uname", password:"pwd"});
                console.log(`Loading page: ${url}`);
                await page.goto(url, {
                    timeout: 0,
                    waitUntil
                });

                console.log(`Closing page: ${url}`);
                await page.close();
            });

        Promise.all(urlRead).then(function () {
            fs.appendFile('statusFile.txt', Array.from(statusTypeSet).join('\n'), error => {
                if (error) throw error;
                console.log('Status file appended successfully.');
            });
            fs.appendFile('imageFile.csv', Array.from(imageTypeSet).join('\n'), error => {
                if (error) throw error;
                console.log('Image data appended successfully.');
            });
            browser.close();
        });
    } catch (error) {
        console.log('>>>>> Error Occurred - ' + error);
        browser.close();
    }
}