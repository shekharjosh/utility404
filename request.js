const BATCH_SIZE = 10,
    DELAY = 1000;

let https = require('https'),
    fs = require('fs'),
    flow = require('xml-flow'),
    puppeteer = require('puppeteer'),
    inputUrl = process.argv[2] || process.exit(-1),
    fileSize = process.argv[3] || 100000,
    viewportWidth = process.argv[4] || 1300,
    viewportHeight = process.argv[5] || 900;

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
                console.log('>>>>> All data Captured.');
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
                let page = await browser.newPage();
                page.viewport({
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
                        statusTypeSet.add(response.url());
                    }
                    if (response.request().resourceType() === 'image') {
                        response.buffer().then(buffer => {
                            if (buffer.length > fileSize) {
                                imageTypeSet.add(`\n${url}, ${response.url()}, ${buffer.length / 1000 + ' KB'}`);
                            }
                        }, error => {
                            console.log('>>>>> Error Occurred - ' + error);
                        });
                    }
                });
                console.log(`Loading page: ${url}`);
                //await page.authenticate({username:"fp", password:"dove"});
                await page.goto(url, {
                    timeout: 0
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