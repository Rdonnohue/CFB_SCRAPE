const fs = require('fs');
const got = require('got');
const { JSDOM: $ } = require('jsdom');
const { default: fetch } = require('node-fetch');


const getUrl = (year) => `http://www.cfbstats.com/${year}/conference/index.html` 


const scrapeBaseConferenceData = async () =>  {
    const getConferenceLinks = () => {
        return  [...Array(12).fill().keys()].map(key => key + 2009).map(getUrl)
    }
    
    const promises = getConferenceLinks().map((val) => fetch(val))
    
    const responses = await Promise.all(promises);
    const sources = await Promise.all(responses.map(response => response.text()));
    
    let linkMap = [];

    sources.forEach((source) => {
        const dom = new $(source);
        const conferenceList = dom.window.document.getElementById('conferences');
        const links = conferenceList.querySelectorAll('a');
        const linkStrings = Array.from(links).map((link) => {
            return 'http://www.cfbstats.com' + link.getAttribute('href') + `/${link.innerHTML}`;
        });

        linkMap = [...linkMap, ...linkStrings];
    })
    /**
     * @param {string} key
     */
    const extractKey = (key) => {
        // 3 5
        const splitArr = key.split('/')
        return {
            id: splitArr[5],
            year: splitArr[3],
            name: splitArr[splitArr.length - 1]
        }
    }

    const concernedKeys = linkMap.map(extractKey);
    console.log(concernedKeys);
    const url = "http://localhost:4000/conference"

    const sendToServer = (arg) => {
        return fetch(url, {method: "POST", body: JSON.stringify(arg), headers: {"Content-Type": 'application/json'}})
    }

    const potentialFetches = concernedKeys.map(sendToServer);
    Promise.all(potentialFetches);
    //now lets extract the primary key group;
    // const concernedKeys = linkMap.map(() => )


}

scrapeBaseConferenceData();
