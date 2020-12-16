const axios = require('axios');

const scraper = async () => {

    const { data } = await axios.get('http://localhost:8080/api/v1/student/all?fields=fcc,id&omitrelations=true&onlyactive=true');
    const accounts = data;

    const usernames =  accounts.map(account => account.fcc_account)
    console.log(usernames)
    let cache = null;
    const challengeMap = {};
    async function fetchAllChallenges() {
        if (cache == null) {
            const { data: pageData } = await axios.get("https://www.freecodecamp.org/page-data/learn/page-data.json");
            cache = pageData.result.data.allChallengeNode.edges;
            cache.forEach(({ node: challenge }) => {
                if (!challengeMap.hasOwnProperty(challenge.block)) {
                    challengeMap[challenge.block] = { counter: 0, name: challenge.fields.blockName };
                }
                challengeMap[challenge.block].counter += 1;
            })
            // console.log(Object.keys(challengeMap).map(challengeKey => `${challengeKey}||${challengeMap[challengeKey].name}||${challengeMap[challengeKey].counter}`).join('\n'))
        }
        return cache;
    }
    const allChallenges = await fetchAllChallenges();

    console.log(allChallenges)
    
    async function fetchUserProfile(username) {
        const { data } = await axios.get(`https://api.freecodecamp.org/api/users/get-public-profile?username=${username}`);
        if (!data || !data.entities) {
            // console.log('bad request', username, data)
            return false;
        }
        // console.log(data.entities.user[data.result])
        return data.entities.user[data.result];
    }
    
    function isFullyPublic(profile) {
        const {isLocked, showAbout, showCerts, showHeatMap, showLocation, showName, showPoints, showPortfolio, showTimeLine} = profile.profileUI;
        return !isLocked && showAbout && showCerts && showHeatMap && showLocation && showName && showPoints && showPortfolio && showTimeLine;
    }
    
    function addChallengeName(allChallenges, challenge) {
        const challengeNode = allChallenges.find(x=>x.node.id === challenge.id);
        return {
            ...challenge,
            name: challengeNode.node.dashedName,
            blockName: challengeNode.node.fields.blockName,
            block: challengeNode.node.block,
        };
    }
    
    async function getUserProgress(username) {
        const myProfile = await fetchUserProfile(username);
        const public = (myProfile || {}).profileUI ? isFullyPublic(myProfile) : false;
        if (!public || !myProfile) {
            // console.log("Not a public profile", username);
            return;
        }

        const completedChallengeWithNames = myProfile.completedChallenges.map(challenge => addChallengeName(allChallenges, challenge));
        return completedChallengeWithNames;
    }

    function chunks(array, size) {
        return Array.apply(0,{length: Math.ceil(array.length / size)}).map((_, index) => array.slice(index * size, (index + 1) * size))
    }
    const usersChunks = chunks(usernames, 10);

    let progresses = [];
    for (const chunk of usersChunks) {
        const promises = chunk.map(async username => ({ username, progress: await getUserProgress(username) }));
        newProgresses = await Promise.all(promises);
        progresses = progresses.concat(newProgresses.filter(obj => obj.progress));
    }

    for (let i = 0; i < progresses.length; i++) {
        for (let j = 0; j < progresses[j].progress.length; j++) {
            for (let k = 0; k < j; k++) {
                if (progresses[k].progress.name === progresses[j].progress.name) {
                    progress[j].progress.repetition = true;
                    break;
                }  
            } 
        }
    }

    let progressesForEvents  = [];
    for (let i = 0; i < progresses.length; i++) {
        const username =  progresses[i].username;
        const accountObject = accounts.find(account => account.fcc_account === username);
        for (let j = 0; j < progresses[i].progress.length; j++) {
            if (progresses[i].progress[j].repetition) {
                progressesForEvents.push({
                    challengeId: progresses[i].progress[j].id,
                    relatedId: username,
                    userId: accountObject.id,
                    date: progresses[i].progress[j].completedDate,
                    repetition: progresses[i].progress[j].repetition
                })
            } else {
                progressesForEvents.push({
                    challengeId: progresses[i].progress[j].id,
                    relatedId: username,
                    userId: accountObject.id,
                    date: progresses[i].progress[j].completedDate,
                })
            }
        }
    }

    // const lastDateUpdated = 
    // let date = new Date(lastDateUpdated || '2020-06-01')
    let date = new Date('2020-07-01')
    let counter = 0;
    while (date <= new Date()) {

        progressesForEvents.forEach(async(progress) => {
            if(new Date(progress.date).toISOString().split('T')[0] === date.toISOString().split('T')[0]) {
                counter++;
                if (progress.hasOwnProperty("repetition")) {
                    // console.log(progress.userId, new Date(progress.date).toISOString(), progress.relatedId, progress.progress.repetition)
                    try {
                        await axios.post('http://localhost:8080/api/v1/event', {
                            userId: progress.userId,
                            relatedId: progress.relatedId,
                            date: new Date(progress.date).toISOString(),
                            eventName: "COMPLETED_FCC_CHALLENGE", // change
                            type: "fcc",
                            entry: { "challengeId": progress.challengeId, "repetition": progress.progress.repetition}  
                        })
                    } catch (err) {
                        console.log(err.message)
                    }
                } else {
                    try {
                        console.log(progress.userId, new Date(progress.date).toISOString(), progress.relatedId)
                        await axios.post('http://localhost:8080/api/v1/event', {
                            userId: progress.userId,
                            relatedId: progress.relatedId,
                            date: new Date(progress.date).toISOString(),
                            eventName: "COMPLETED_FCC_CHALLENGE",
                            type: "fcc",
                            entry: { "challengeId": progress.challengeId}  
                        })
                    } catch (err) {
                        console.log(err.message)
                    }
                }
            }
        })
        
        date.setDate(date.getDate() + 1)
    }
    console.log(progressesForEvents)
    console.log(counter)
    
    return progresses;
}

module.exports = scraper;
