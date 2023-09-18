const axios = require('axios');
const cheerio = require('cheerio')
const fs = require('fs')

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

function extractName(tag_name) {
    result = ""
    for (let i = 0; i < tag_name.length; i++) {
        if (tag_name[i].match(/[a-z]/i)){
            result += tag_name[i]
        }else{
            break
        }
    }
    return result
}

function sleepFor(sleepDuration){
    var now = new Date().getTime();
    while(new Date().getTime() < now + sleepDuration){ /* Do nothing */ }
}

function extract(extractor, data) {

    if (!data.selector)
        return []
    const tag_name = extractName(data.selector)
    console.log(tag_name)


    const elements = extractor(data.selector)
    res = []
    for (let i in elements){
        const element = elements[i]
        // console.log(element)
        if (!element)
            continue
        if (!element.name){
            console.log(element)
            continue
        }
        if (!element.name.toString().includes(tag_name)){
            console.log(element)
            continue
        }
        if (data.attr){
            if (element.attribs){
                res.push(element.attribs[data.attr])
            }
        }else{
            try {
                const t = element.getText()
                console.log("got text", t)
                res.push(element.getText())
            }catch (e) {
                console.log(e.toString())
                continue
            }
        }
    }
    if (data.required){
        res2 = []
        for (let j in res){
            if (!res[j].toString().includes(data.required))
                continue
            res2.push(res[j])
            return res2
        }
    }
    return res
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


        if (selector_attr === ""){
            try {

                const t = el.text()
                console.log("got text", t)
                res.push(el.text())
            }catch (e) {
                console.log(e.toString())
                continue
            }

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
        console.log(task)
        resp = await axios.get(task.url)
        console.log("Driver got", resp.request.toString(), resp.status);
        const page = cheerio.load(resp.data)
        links2 = page(task.feed.selector)
        links = []
        if (links2.length === 0) {
            console.log("No links found, quitting")
            break glock;
        }
        console.log("Found", links2.length, "links")
        for (let i in links2) {
            try {
                link = links2[i]
                //console.log(link)
                if (!link){
                    console.log("skipping due to null")
                    console.log(link)
                    continue
                }
                if (task.feed.required){
                    if (!link.toString().includes(task.feed.required))
                        console.log("skipping because does not contain requred")
                        continue
                }
                var l = ""
                if (task.feed.attr !== "") {
                    l = link.attribs[task.feed.attr]
                    if (l === ""){
                        console.log("Skipping because empty attr")
                        continue
                    }

                }else{
                    l = link.text()
                }
                if (l.startsWith("/"))
                    l = task.url + l
                links.push(l)
            } catch (e) {
                console.log(e)
                continue
            }


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
                textElements = extract(m_p, task.text)
                console.log("extracted text elements", textElements)
                m.href = link
                // for (let i = 0; i < textElements.length; i++) {
                //     m.text += textElements[i] + "\n"
                // }
                m.text = textElements.join("\n")
                m.raw.text = m.text

                try {
                    m.links = extract(m_p, task.links)
                } catch (e) {
                    console.log(e)
                    console.log("Errors while getting m.Links")
                }

                try {
                    if (!(task.published.selector === '')){
                        const pub = extract(m_p, task.published)

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
                    m.images = extract(m_p, task.images)
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


        fname = Date.now().toString() + ".json"
        console.log(fname)
        rdata = JSON.stringify(res, null, " ")
        fs.writeFileSync("testOutput/" + fname, rdata)

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
