var https = require('https'),
    fs = require('fs'),
    flow = require('xml-flow'),
    puppeteer = require('puppeteer'),
    inputUrl = 'https://www.lipton.com/ru/sitemap.xml',
    file = fs.createWriteStream('sitemap.xml');   

https.get(inputUrl, function(res) {
    res.on('data', function(xmlData) {
        file.write(xmlData);
    }).on('end', function() {
        file.end();
        
        var inFile = fs.createReadStream('sitemap.xml'),
            xmlStream = flow(inFile),
            array = [],
            statusTypeSet = new Set(),
            imageTypeSet = new Set();
            
            xmlStream.on('tag:loc', function(url){
                array.push(url.$text);              
            }).on('end', async function(){
                try {
                    var browser = await puppeteer.launch(),
                        urlRead = array.map(async function(url, i){
                            var page = await browser.newPage();
                            
                            process.on("unhandledRejection", function(reason, p) {
                              console.error("Unhandled Rejection at: Promise", p, "reason:", reason);
                              browser.close();
                            });
                            
                            await page.setRequestInterception(true);
                                
                            page.on('request', function(request) {
                                request.continue();
                            });
                            
                            page.on('response', function(response){
                                if (response.status() === 404) {
                                    statusTypeSet.add(response.url());
                                }
                                
                                if(response.request().resourceType() === 'image') {
                                    response.buffer().then(buffer => {
                                        if(buffer.length > 100000) {
                                            imageTypeSet.add(response.url() + ' ( Size: ' + buffer.length/1000 + ' kb )');
                                        }
                                    }, error => {
                                        console.log(error)
                                    });
                                }
                            });

                            console.log(`loading page: ${url}`);
                            //await page.authenticate({username:"fp", password:"dove"});
                            await page.goto(url, {timeout: 0});
                            
                            console.log(`closing page: ${url}`);
                            await page.close();
                        });
                    
                    Promise.all(urlRead).then(function() {
                        fs.writeFile('statusFile.txt', Array.from(statusTypeSet).join('\n'), function(err) {
                            if(err) throw err;
                            console.log('Status file saved successfully');
                      });
                      
                      fs.writeFile('imageFile.txt', Array.from(imageTypeSet).join('\n'), function(err) {
                                if(err) throw err;
                                console.log('Image file saved successfully');
                        });
                      
                      browser.close();
                    });
                } catch(e) {
                    console.log(e);
                    browser.close();
                }   
            });
    });
});