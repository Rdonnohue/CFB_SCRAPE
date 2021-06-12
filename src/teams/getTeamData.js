const { default: fetch } = require("node-fetch")
const {JSDOM: $} = require('jsdom')
const getTeamData = async () => {
    /**
     * @param {[{id: string, year: string}]} data
     */
    const processConferences = async (data) => {

        const generateUrl = (year, id) => `http://www.cfbstats.com/${year}/leader/${id}/team/offense/split01/category09/sort01.html`;
        const generateFetch = (url) => fetch(url);
        const processLinks = (str) => {
            const [name,year,,id] = str.split('/');
            return {
                year,
                id,
                name,
            };
            
        }
        const requests = data.map(({year, id}) => {
            const url = generateUrl(year, id);
            return generateFetch(url);
        });

        const responses = await Promise.all(requests);
        const sources = await Promise.all(responses.map(r => r.text()));
        let consolidatedLinks = [];
        sources.map((source, index) => {
            const dom = new $(source);
            const content = dom.window.document.querySelector('div.leaders>.leaders');
            const links = content.querySelectorAll('td>a');
            Array.from(links).map(link => {
                const attribute = link.innerHTML + link.getAttribute('href');
                consolidatedLinks.push(
                    {
                        ...processLinks(attribute),
                        conference_id: data[index].id,
                        conference_year: data[index].year,
                    }
                );
            });
        });
        
        const passToServer = (data) => {
            return fetch('http://localhost:4000/team', {
                method: 'post',
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });
        }

        const toServer = consolidatedLinks.map(passToServer);
        await Promise.all(toServer);

    }
    const getMoreData = async (skip, take) => {
        const res = await fetch(`http://localhost:4000/conference?skip=${skip}&take=${take}`);
        const {
            data
        } = await res.json();

        return data;
    };

    const {
        count,
    } = await (await fetch('http://localhost:4000/conference')).json();
    // lets batch these actions
    let begin = 0;
    while (begin < count) {
        console.log(begin,10);
        const data = await getMoreData(begin, 10);
        await processConferences(data);
        begin += 10;
    }
}

getTeamData();