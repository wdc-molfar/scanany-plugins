const axios = require('axios');
const cheerio = require('cheerio')
const md5 = require("md5")

let scraperInstance


const extractData => ($, options) => {
    
    let res = []
    
    $(options.selector).each((index, element) => {
        const el = $(element)
        if(!options.attr){
            if(el.text) res.push(el.text())
        } else {
            if(el.attr) res.push(el.attr(options.attr))
        }
    })

    const requred = (options.required) ? ( d => d.includes(options.required) ) : ( () => true ) 

    return res.filter(required)

}


const startParsing = async(command, context) => {
    
    let task = scraperInstance.resolveValue(command.task, context).options
    let result = []
 
    resp = await axios.get(task.url)
    if(resp.status != 200) return []
    
    const mainPage = cheerio.load(resp.data)
    let links = extractData(mainPage, task.feed).filter( l => l )

    for ( let i=0; l < links.length; i++ ) {
        
        let link = links[i]
        const p = await axios.get(link)

        if(p.status != 200) continue

        const currentPage = cheerio.load(p.data)
        let text =  extractData( currentPage, task.text ).join("\n")

        if(!text) continue

        result.push({
            scraper: {
                message: {
                    raw:{
                        text
                    },
                    text,
                    links: extractData(currentPage, task.links),
                    images: extractData(currentPage, task.images),
                    publishedAt: (task.published) ? extractData(currentPage, task.published) || new Date() : new Date()
                    md5: md5(text)
                }
            }
        })    
                
    } 

    let into = scraperInstance.resolveValue(command.into || command.as, context)
    context = await scraperInstance.executeOnce({into}, context, result)

    return context
}



module.exports = {
    register: scraper => {
        scraperInstance = scraper
    },
    rules: [
        {
            name:[
                "start_parsing"
            ],
            _execute: startParsing
        }
    ]
}
