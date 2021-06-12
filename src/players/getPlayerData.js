const { JSDOM: $ } = require("jsdom");
const { default: fetch } = require("node-fetch");

// I will have to use the source ids, and then run through and some ids that are not being used
const idTracker = (() => {
    let idTacking = 0;
    const giveNextId = () => {
        return `x${idTacking++}`;
    } 
    return giveNextId;
})();
const getPlayerData = async () => {

    const generateQueryParams = (obj) => {
        return Object.keys(obj)
        .map((key) => `${key}=${obj[key]}`)
        .join('&');
    }

    const getBasePlayerUrl = () => `http://localhost:4000/player`;

    const getBaseURL = () => `http://localhost:4000/team`;

    const generateTeamDataURL = (skip, take) => {
        return `${getBaseURL()}?${generateQueryParams({skip, take})}`;
    }
    
    const getCount = async () => {
        const response = await fetch(generateTeamDataURL(0, 1));
        const data = await response.json();
        
        return data.count;
    }

    const getTeamData = async (skip, take) => {
        const response = await fetch(generateTeamDataURL(skip, take));
        
        return (await response.json()).data;
    }

    const processTeamDataResponse = (data) => {
        return {
            year: data.year,
            id: data.id,
        }
    }

    const generateURLForScrapingRoster = (id, year) => `http://www.cfbstats.com/${year}/team/${id}/roster.html`

    const generateFetchesForPlayerData = ({
        id, year,
    }) => {
        return fetch(generateURLForScrapingRoster(id, year))
    }

    const processSource = (fetcher) => {
        return fetcher.text();
    }

    const processRaw = (source) => {
        return new $(source);
    }
    /**
     * @param {$} dom
     */
    const processNode = (dom) => {
        const {
            window: {
                document,
            }
        }  = dom

        /**
         * @param {Element} node
         */
        const hasLink = (node) => {
            return node && node.querySelector('a') && node.querySelector('a').hasAttribute('href');
        }

        const playerDataEntry = document.querySelectorAll('.team-roster > .team-roster > tbody > tr > td.player-name');
        console.log(playerDataEntry.length);
        const data = Array.from(playerDataEntry).map(entry =>  {
            if (hasLink(entry)) {
                //do something with link
                const [
                    ,year,,,id
                ] = entry.querySelector('a').getAttribute('href').split('/');
                console.log(year, id);
                return {
                    id,
                    year,
                    name: entry.querySelector('a').innerHTML,
                }
            } else {
                //just grab the name
                //place year in here later to match team year
                return {
                    id: '',
                    year: '',
                    name: entry.innerHTML,
                }
            }
        })
        return data;
    }

    const toServer = (data) => {
        return fetch(getBasePlayerUrl(), {
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
    }


    let base = 0;
    const count = await getCount();
    const fs = require('fs');
    while (base < count) {
        let data = await getTeamData(base, 10);
        data = data.map(processTeamDataResponse);
        const requests = data.map(generateFetchesForPlayerData);
        const responses = await Promise.all(requests);
        const sources = await Promise.all(responses.map(processSource));
        const nodes = sources.map(processRaw);
        let playerData = nodes.map(processNode);
        playerData = playerData.map((entry, index) => {
            return entry.map((val) => {
                if (!val.id) val.id = idTracker();
                if (!val.year) val.year = data[index].year;
                if (!val.name) val.name = 'ANONYMOUS PLAYER';
                val.team_year = data[index].year;
                val.team_id = data[index].id
                return val;
            })
        })
        playerData = playerData.reduce((acc, val) => [...acc, ...val], []);
        // this is going to be chunky, so it would be best to allow for batch insertions...
        // but I need to make sure I am not slamming the scraping point too hard anyway, so we could use a buffer.
        const toServerRequests = playerData.map(toServer);
        await Promise.all(toServerRequests);
        base += 10;
    }
}

getPlayerData();