const fs = require('fs');
const { JSDOM: $ } = require('jsdom');
const { default: fetch } = require('node-fetch');
const path = require('path');
const getPassing = async () => {
    const getTeamsCount = async () => {
        const response = await fetch('http://localhost:4000/team?skip=0&take=0');
        
        const data = await response.json();
        
        return data.count;
    }

    const getTeamData = async (skip, take) => {
        console.log(skip, take);
        const response = await fetch(`http://localhost:4000/team?skip=${skip}&take=${take}`);
        const {
            data
        } = await response.json();
        return data;
    }

    const generateCFBURL = ({year, id}) => `http://www.cfbstats.com/${year}/team/${id}/passing/index.html`;

    /**
     * @param {Element} node
     */
    const parseStats = (node) => {
        const getParent = (a) => a.map(b => b.parentElement.parentElement);
        const sliceStates = (a) => a.children |> Array.from |> ((val) => val.slice(5));
        const getValues = (b) => b.map(c => c.innerHTML);
        const toObj = (val) => ({
            Att: val[0],
            Comp: val[1],
            Pct: val[2],
            Yards: val[3],
            Yards_Att: val[4],
            TD: val[5],
            Int: val[6],
            Rating: val[7],
            Att_G: val[8],
            Yards_G: val[9],
        });
        const pack = (val) => {
            return {
                stats: {
                    ...val
                }
            }
        }
        const table = node.querySelector('.leaders>.leaders>tbody');
        const links = table.querySelectorAll('a') |> Array.from |> getParent;
        const data = links.map(sliceStates).map(getValues).map(toObj).map(pack);
        return data;
    } 

    const parsePlayerData = (node) => {
        const data = node.querySelector('.leaders>.leaders>tbody') 
        |> ((val) => val.querySelectorAll('a')) 
        |> Array.from
        |> ((val) => val.map(v => v.parentElement.parentElement))
        |> ((val) => {
            const r = val.map((stuff) => {

                const children = stuff.children |> Array.from;
                children.shift();
    
                const link = children[0].querySelector('a').getAttribute('href');
                const [,year,,,id] = link.split('/')
                const yearName = children[1].innerHTML;
                const position = children[2].innerHTML;
                return {
                    link, yearName, position, year, id
                }
            })
            return r;
        })
        return data;
    }

    const mergeArrays = (a,aKey, b, bKey) => {
        if (a.length !== b.length) {
            throw new Error('ARRAYS ARE NOT THE SAME');
        }

        const newArr = [];

        for (let i = 0; i < a.length; i++) {
            newArr.push({
                [aKey]: `\`${a[i]}\``,
                [bKey]: b[i],
            })
        }

        return newArr;
    }

    const countData = await getTeamsCount();
    let start = 0;
    while (start < countData){
        const teamData = await getTeamData(start, 2);
        const urls = teamData.map(generateCFBURL);
        const requests = urls.map(val => fetch(val));
        const responses = await Promise.all(requests);
        const sources = responses.map(r => r.text());
        const parsedSources = await Promise.all(sources);
        const nodes = parsedSources.map((source) => new $(source));
        const stats = nodes.map(node => parseStats(node.window.document.body));
        const playerData = nodes.map(node => parsePlayerData(node.window.document.body));
        
        const merged = mergeArrays(stats, 'stats', playerData, 'playerData');

        console.log(JSON.stringify(merged, null, 5));
        fs.writeFileSync('test.json', JSON.stringify(merged, null, 5));
        return;
    }
}

getPassing();
