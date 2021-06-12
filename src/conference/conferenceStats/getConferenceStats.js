const {JSDOM: $} = require('jsdom');
const { default: fetch } = require('node-fetch');
const {mysqlConfig} = require('../../mysqlConfig/config');

const getBaseCFBURL = () => `http://www.cfbstats.com`
const getURL = (link) => `${getBaseCFBURL()}${link}`; 
const generateNode = (src) => new $(src)
const mysql = require('mysql');
/**
 * @param {{name: string, link: string, tableName: string}[]} baseTableData
 */
const generateSchema = async (baseTableData) => {
    const generateRequests = (link) => {
        return fetch(getURL(link));
    }

    const getSource = (response) => {
        return response.text();
    }

    /**
     * @param {Element} node
     */
    const getColumns = (node) => {
        /**
         * @param {Element} headerNode
         */
        const parseHeader = (headerNode) => {
            let children = Array.from(headerNode.children);
            const tst = 1;
            const columns = children.filter(child => child.innerHTML !== '' 
            && child.innerHTML !== 'Name' 
            && child.innerHTML !== 'Yr'
            && child.innerHTML !== 'Pos'
            && child.innerHTML !== 'G'
            ).map(child => child.innerHTML.replace(/[ .,\/]/g, '_'));
            return columns;
        }
        /**
         * @param {Element} firstRowNode
         */
        const getDataTypes = (firstRowNode) => {
            /**
             * 
             * @param {string} val 
             */
            const determineType = (val) => {
                const attemptedFloat = parseFloat(val);
                if (!isNaN(attemptedFloat)) return 'float'
            };

            const getValue = (tableNode) => tableNode.innerHTML;
            let children = Array.from(firstRowNode.children).slice(5);
            const values = children.map(getValue).map(determineType);
            return values;
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

        const rows = node.querySelectorAll('div.leaders > table.leaders > tbody > tr');
        const rowArr = Array.from(rows);
        if (rowArr.length === 0) return;
        const header = rowArr.shift();
        const firstRowNode = rowArr.shift();
        const columns = parseHeader(header);
        const dataTypes = getDataTypes(firstRowNode);
        const mergedArrays = mergeArrays(columns, 'columnName', dataTypes, 'dataType');
        return mergedArrays;
    }


    const requests = baseTableData.map((el) => generateRequests(el.link));
    const responses = await Promise.all(requests);
    const sources = responses.map(getSource);
    const resolvedSources = await Promise.all(sources);
    const nodes = resolvedSources.map(generateNode);
    const columns = nodes.map(node => node.window.document).map(getColumns);
    return columns;

};

const getTableNames = async () => {

    /**
     * @param {Element} node
     */
    const getRelevantLinks = (node) => {
        
        const nodes = node.querySelectorAll('#leftColumn>.section>ul>li>a')
        return Array.from(nodes).filter(child => child.innerHTML !== 'Place Kicking');
    };
    /**
     * @param {Element} node
     */
    const parseLinks = (node) => {
        return {
            name: node.innerHTML,
            link: node.getAttribute('href'),
        }
    };

    const generateTableNames = (data) => {
        return {
            ...data,
            tableName: data.name.replace(/ /g, '_'),
        }
    }

    const response = await fetch(getURL('/2020/team/8/index.html'));
    const source = await response.text();
    const parentNode = generateNode(source).window.document;
    const relevantLinks = getRelevantLinks(parentNode);
    let data = relevantLinks.map(parseLinks);
    data = data.map(generateTableNames);
    return data.slice(2, 17);
}   

const generateTableQuery = (queryMeta) => {
    const generateTableCreateQuery = ({
        tableName,
        schemaInfo,
    }) => {
        const generateColumn = ({columnName, dataType}) => {
            return `${columnName} ${dataType}`
        }
        const query = `
            CREATE TABLE ${tableName} (
                ${schemaInfo.map(generateColumn).join(',')}
            )
        `;
        return query;
    }

    const appendPrimaryKeys = (data) => {
        return {
            ...data,
            schemaInfo: [...data.schemaInfo
                ,{
                    columnName: 'id',
                    dataType: 'varchar(20)'
                }
                ,{
                    columnName: 'year',
                    dataType: 'varchar(10)',
                },
                {
                    columnName: 'PRIMARY KEY (id, year)',
                    dataType: '',
                }
            ]
        }
    };

    const appendForeignKeys = (data) => {
        return {
            ...data,
            schemaInfo: [
                ...data.schemaInfo,
                {
                    columnName: 'FOREIGN KEY (id, year) references players(id, year)',
                    dataType: '',
                }
            ]
        }
    }
    console.log(JSON.stringify(queryMeta, null, 4));
    const queries = queryMeta
    .filter(val => !!val)
    .map(appendPrimaryKeys)
    .map(appendForeignKeys)
    .map(generateTableCreateQuery);
    return queries;
}

const createTables = (queries) => {
    const connection = mysql.createConnection(mysqlConfig)
    connection.connect(() => {
        const generateQuery = (query) => {
            console.log(query);
            connection.query(query, connection, () => {
                console.log('done');
            })
        }
        queries.map(generateQuery);
    })
}

const main = async () => {
    const tableLinkData = await getTableNames();
    const result = await generateSchema(tableLinkData);
    const mergeData = (val, index) => {
        return {
            schemaInfo: val,
            tableName: tableLinkData[index].tableName,
        }
    }
    const queryMeta = result.map(mergeData);
    const queries = generateTableQuery(queryMeta);
    createTables(queries);


}

main();