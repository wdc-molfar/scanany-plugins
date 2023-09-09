const axios = require('axios');
const cheerio = require('cheerio')

let scraperInstance
const md5 = require("md5")

function getMethods(obj) {
    var result = [];
    for (var id in obj) {
        try {
            if (typeof(obj[id]) == "function") {
                result.push(id + ": " + obj[id].toString());
            }
        } catch (err) {
            result.push(id + ": inaccessible");
        }
    }
    return result;
}


function extractData(p_func, selector, selector_attr, selector_must_contain) {
    const data = p_func(selector)
    res = []
    for (let i in data){
        const el = data[i]
        //console.log("Got element", el)
        if (el === null){
            console.log("skipped because null")
            continue
        }

        console.log("not skipped")

        if (selector_attr === ""){
            const t = el.text()
            console.log("got text", t)
            res.push(el.text())
        }else{
            if (res.attribs)
                res.push(res.attribs[selector_attr])
        }
    }
    if (selector_must_contain !== ""){
        res2 = []
        for (let j in res){
            if (!res[j].toString().includes(selector_must_contain))
                continue
            res2.push(res[j])
            return res2
        }
    }
    return res
}


const startParsing = async(command, context) => {
    console.log(command.into)
    console.log(command)
    // const task = context.task.options
    let task = scraperInstance.resolveValue(command.task, context).options
    console.log(task)
    let links;
    let res;
    let link;
    let m;
    let textElements;

    let main_resp;
    glock: try {
        resp = await axios.get(task.url)
        console.log("Driver got", resp.request.toString(), resp.status);
        const page = cheerio.load(resp.data)
        links2 = page(task.feed_selector)
        links = []
        if (links2.length === 0) {
            console.log("No links found, quitting")
            break glock;
        }
        for (let i in links2) {
            link = links2[i]
            if (link == null || link.attribs == null)
                continue
            if (task.feed_selector_must_contain !== ""){
                if (!link.toString().includes(task.feed_selector_must_contain))
                    continue
            }
            var l = ""
            if (task.feed_selector_attr !== "") {
                l = link.attribs["href"]
                if (l === "")
                    continue

            }else{
                l = link.text()
            }
            if (l.startsWith("/"))
                l = task.url + l
            links.push(l)

        }
        console.log("Got", links.length, "links on page")
        for (let j in links){
            console.log(links[j])
        }
        res = []
        //await new Promise(r => setTimeout(r, 20000));
        for (let i = 0; i < links.length; i++) {
            try {
                link = links[i]
                const p = await axios.get(link)
                console.log("Driver got", p.request.toString())
                let m = {
                    raw: {},
                    text: "",
                    links: [],
                    images: [],
                }

                let m_p = cheerio.load(p.data)
                console.log("extracting text elements")
                textElements = extractData(m_p, task.text_selector, task.text_selector_type, task.text_selector_attr, task.text_selector_must_contain)
                console.log("extracted text elements")
                m.href = link
                // for (let i = 0; i < textElements.length; i++) {
                //     m.text += textElements[i] + "\n"
                // }
                m.text = textElements.join("\n")
                m.raw.text = m.text

                try {
                    m.links = extractData(m_p, task.links_selector, task.links_selector_attr, task.links_selector_must_contain)
                } catch (e) {
                    console.log(e)
                    console.log("Errors while getting m.Links")
                }

                try {
                    if (!(task.published_selector === '')){
                        const pub = extractData(m_p, task.published_selector, task.published_selector_attr, task.published_selector_must_contain)

                        if (pub && pub.length()  > 0)
                            m.publishedAt = pub[0]
                    }

                } catch (e) {
                    //console.log(e)
                    console.log("Errors while getting m.PublishedAT")
                }

                if (!m.publishedAt)
                    m.publishedAt = new Date()
                try {
                    m.images = extractData(m_p, task.images_selector, task.images_selector_attr, task.images_selector_must_contain)
                } catch (e) {
                    console.log(e)
                    console.log("Errors while getting m.images")
                }

                if (!m.text)
                    continue

                m.md5 = md5(m.text)
                res.push({scraper: {message: m}})
                console.log("------------------------------------------------------------")
                console.log("Pushed message:", m)
                console.log("------------------------------------------------------------")

            } catch (e) {
                console.log(e)
                console.log("Failed to get link", link)
            }

        }
    } finally {
    }
    //console.log(JSON.stringify(res))
    let into = scraperInstance.resolveValue(command.into || command.as, context)
    context = await scraperInstance.executeOnce({into}, context, res)

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
