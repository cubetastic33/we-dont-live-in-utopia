const https = require('https');
const Discord = require('discord.js');
const MongoDB = require('mongodb');
const ytdl = require('ytdl-core');
const search = require('youtube-search');
const cheerio = require('cheerio');
const config = require('./config.json');

// Invite link:
// https://discordapp.com/oauth2/authorize?&client_id=523114941394452480&scope=bot&permissions=8

const discordClient = new Discord.Client();
const MongoClient = MongoDB.MongoClient;
var queues = {};
const colors = {
	error: 0xB71C1C,
	information: 0xFFEB3B,
	status: 0x311B92
};

function shuffle(array) {
	var currentIndex = array.length, temporaryValue, randomIndex;
	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}
	return array;
}

class Queue {
	constructor() {
		this.songs = [];
		this.position = -1;
		this.status = 'stopped';
	}

	song() {
		if (this.textChannel) {
			if (this.songs[this.position]) {
				this.textChannel.send({embed: {
					color: colors.status,
					description: `Currently playing:\n[${this.songs[this.position][0]}](${this.songs[this.position][1]})`
				}}).catch(err => this.textChannel.send(`Error: ${err}`));
			} else {
				this.textChannel.send({embed: {
					color: colors.error,
					description: 'No song is currently playing'
				}}).catch(err => this.textChannel.send(`Error: ${err}`));
			}
		}
	}

	showQueue() {
		if (this.textChannel) {
			let queue = '';
			for (let i=1; i<=this.songs.length; i++) {
				queue += `\n${i}) ${this.songs[i-1][0]}`;
				if (this.position+1 === i) {
					queue += '\n	Currently playing';
				}
			}
			this.textChannel.send(`\`\`\`nim\nQueue: ${queue}\`\`\``);
		}
	}

	shuffle(message) {
		if (this.textChannel) {
			if (this.position <= this.songs.length-2) {
				this.songs = this.songs.slice(0, this.position+1).concat(shuffle(this.songs.slice(this.position+1)));
				message.react('🔀');
			} else {
				message.channel.send({embed: {
					color: colors.error,
					description: 'There are no songs left in the queue!'
				}});
			}
		}
	}

	add(song) {
		this.songs.push(song);
		console.log('Adding song.', this.position, this.songs.length-2);
		this.textChannel.send({embed: {
			color: colors.information,
			description: `Added [${song[0]}](${song[1]}) to the queue`
		}});
		if (this.position === this.songs.length-2 && this.status === 'stopped') {
			// If the queue was over, play the newly added song
			this.play(song);
		}
	}

	remove(range) {
		this.songs.splice(range[0]-1, (range.length === 2?range[1]-range[0]:0)+1);
		this.textChannel.send({embed: {
			color: colors.information,
			description: `Removed song${range.length === 2?'s':''} ${range[0]}${range.length === 2?` - ${range[1]}`:''} from the queue`
		}});
	}

	addPlaylist(playlist, songs) {
		this.songs = this.songs.concat(songs);
		this.textChannel.send({embed: {
			color: colors.information,
			description: `Added playlist "${playlist}" to the queue`
		}});
		if (this.position === this.songs.length-songs.length-1 && this.status === 'stopped') {
			// If the queue was over, play the newly added songs
			this.play(songs[0]);
		}
	}
	
	play(song) {
		this.dispatcher = this.voiceConnection.playStream(
			ytdl(song[1], { filter: 'audioonly' })
		);
		this.position = this.songs.indexOf(song);
		if (this.status !== 'repeating') this.status = 'playing';
		this.textChannel.send({embed: {
			color: colors.information,
			description: `Playing [${song[0]}](${song[1]})`
		}});
		this.dispatcher.once('end', () => {
			console.log(`Ended with status ${this.status} and position ${this.position}`);
			// If the current song isn't on repeat
			if (this.status === 'playing') this.status = 'stopped';
			if (this.position <= this.songs.length-2) {
				// If there's atleast 1 more song in the queue
				console.log('ended, playing next song');
				this.play(this.songs[this.position+(this.status === 'repeating'?0:1)]);
			}
		});
	}

	repeat() {
		if (this.dispatcher && this.textChannel) {
			this.status = 'repeating';
			this.textChannel.send({embed: {
				color: 0x90ee02,
				description: 'Current song set to repeat.'
			}});
		}
	}

	pause() {
		if (this.dispatcher) {
			this.dispatcher.pause();
			this.status = 'paused';
		}
	}

	resume() {
		if (this.dispatcher) {
			this.dispatcher.resume();
			this.status = 'playing';
		}
	}

	jump(to) {
		if (this.songs[to-1]) {
			if (this.dispatcher) {
				this.status = 'playing';
				this.position = to-2;
				this.dispatcher.end();
			} else {
				this.textChannel.send({embed: {
					color: colors.error,
					description: 'No song is currently playing'
				}});
			}
		} else {
			this.textChannel.send({embed: {
				color: colors.error,
				description: 'No song was found at that position!'
			}});
		}
	}
}

function queue(guild) {
	//console.log(`queues: ${queues}`);
	if (!queues[guild.id.toString()]) queues[guild.id.toString()] = new Queue();
	return queues[guild.id];
}

discordClient.login(config.token);

discordClient.on('ready', () => {
	console.log(`Logged in as ${discordClient.user.tag}!`);
	discordClient.user.setActivity(`${config.prefix}help`, { type: 'LISTENING' });
});

MongoClient.connect(config.mongoDBURI, {
	useNewUrlParser: true,
	reconnectTries: Number.MAX_VALUE,
	reconnectInterval: 1000}, function(err, client) {
	if(err) {
		console.log('Error occurred while connecting to MongoDB Atlas...\n',err);
	}
	console.log('Connected to MongoDB Atlas...');
	const collection = client.db("data").collection("playlists");
	// perform actions on the collection object
	client.close();
});

function isURL(testString) {
	return !!testString.match(/^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i);
}

discordClient.on('guildMemberAdd', member => {
	// Send the message to a designated channel on a server:
	const channel = member.guild.channels.find(ch => ch.name === 'general');
	// Do nothing if the channel wasn't found on this server
	if (!channel) return;
	// Send the message, mentioning the member
	channel.send(`Welcome to the server, ${member}! If you're new to Discord, head over to #announcements and read the messages to get started. You'll be granted suitable roles shortly.`);
});

discordClient.on('message', message => {
	if (message.content.substr(0, config.prefix.length) == config.prefix) {
		let command = message.content.substr(config.prefix.length).trim();
		if (command.toLowerCase() === 'help') {
			// Display the help message
			message.channel.send({embed: {
				color: 0xFB8C00,
				title: 'Help',
				description: "Hello! My name is `We don't live in Utopia`\
				(Version 0.1). It's true, and you know it. My prefix is `"+
				config.prefix+"`. The commands themselves are case insensitive,\
				and both `"+config.prefix+"<command>` and `"+config.prefix+
				" <command> will work.` But, the values given are not\
				necessarily case insensitive.",
				fields: [{
					name: 'Supported commands',
					value: 'The currently supported commands are `help`,\
					`ping`, `playlist`, `play`, `repeat`, `pause`, `resume`,\
					`next`, `previous`, `jump`, `remove`, `queue`, `lyrics`,\
					`song`, and `stop`.'
				}, {
					name: 'Command info',
					value: `
						**help**: Display this help message
						**ping**: I'll respond with pong
						**playlist**: Create, play and modify playlists
						**play <url/query>**: Play the audio from the YouTube video url or the first video result with the search query
						**repeat**: Repeat the currently playing song (if any)
						**pause**: Pause the currently playing song (if any)
						**resume**: Resume if the song is paused
						**next**: Play the next song in the queue (if any)
						**previous**: Play the previous track in the queue (if any)
						**jump <to>**: Jump to a track in the queue (if it exists)
						**remove <start(|end)>**: Remove a track, or specify 2 numbers separated with \`|\` to remove a range of tracks
						**queue**: Display the queue
						**lyrics (<query>)**: Display the lyrics for the currently playing song, or the given query
						**song**: Display the currently playing song (if any)
						**stop**: Stop the currently playing song, clear the queue, and exit the voice channel
					`
				}, {
					name: 'Playlists',
					value: `
						**playlist create <name> <list of|songs you|want to|add>**: Create a playlist of the given name with the given songs. The songs should be separated with \`|\`.
						**playlist play <name>**: Add the playlist to the queue
					`
				}],
				footer: {
					icon_url: 'https://firebasestorage.googleapis.com/v0/b/cubetastic-33.appspot.com/o/profile-pics%2FAravind%20k?alt=media&token=2db6b9d0-62c7-40df-bf99-e64e34db4119',
					text: '© 2018 | aravk33'
				}
			}});
		} else if (command.toLowerCase() === 'ping') {
			// A simple ping command to check if the bot works
			message.channel.send('pong');
		} else if (command.split(' ')[0].toLowerCase() === 'playlist' && command.split(' ').length >= 3) {
			// Actions based on playlists
			if (command.split(' ')[1].toLowerCase() === 'create' && command.split(' ').length > 3) {
				// Create a new playlist
				// Connect to database
				MongoClient.connect(config.mongoDBURI, {useNewUrlParser: true}, function(err, client) {
					if (err) return console.log('Error:', err);
					const collection = client.db('music').collection('playlists');
					// Add the playlist to the collection if the name is available
					collection.find({name: command.split(' ')[2]})
					.count()
					.then(result => {
						if (result === 0) {
							let playlist = {name: command.split(' ')[2], songs: []};
							let songs = command.split(' ').slice(3).join(' ').split('|');
							message.channel.send(`Creating playlist "${command.split(' ')[2]}" with songs ${songs.join(', ')}`);
							for (var i=0; i<songs.length; i++) {
								let opts = {
									maxResults: 1,
									key: config.googleApiKey,
									type: 'video'
								}
								search(songs[i], opts, function(err, results) {
									if(err) return console.log(err);
									console.log(results[0].link);
									playlist.songs.push([results[0].title, results[0].link]);

									if (playlist.songs.length === songs.length) {
										console.log(playlist);
										collection.insertOne(playlist, (err, res) => {
											message.channel.send(err?`Error: ${err}`:
											`Successfully created playlist "${command.split(' ')[2]}"`);
											client.close();
										});
									}
								});
							}
						} else {
							message.channel.send({embed: {
								color: colors.error,
								description: `Playlist "${command.split(' ')[2]}" already exists! Choose a different name.`
							}});
						}
					});
				});
			} else if (command.split(' ')[1].toLowerCase() === 'delete') {
				// Delete a playlist
				// Connect to database
				MongoClient.connect(config.mongoDBURI, {useNewUrlParser: true}, function(err, client) {
					if (err) return console.log('Error:', err);
					const collection = client.db('music').collection('playlists');
					// Add the playlist to the collection if the name is available
					collection.find({name: command.split(' ')[2]})
					.count()
					.then(result => {
						if (result === 1) {
							// The playlist exists
							collection.deleteOne({name: command.split(' ')[2]})
								.then(() => {
									message.channel.send({embed: {
										color: colors.information,
										description: `Successfully deleted playlist "${command.split(' ')[2]}"`
									}});
								});
						} else {
							// The playlist doesn't exist
							message.channel.send({embed: {
								color: colors.error,
								description: 'No such playlist exists.'
							}});
						}
					});
				});
			} else if (command.split(' ')[1].toLowerCase() === 'play') {
				// Add an existing playlist to the queue
				// Connect to database if user is in a voice channel
				if (message.member.voiceChannel) {
					message.member.voiceChannel.join().then(connection => {
						MongoClient.connect(config.mongoDBURI, {useNewUrlParser: true}, function(err, client) {
							if (err) return console.log('Error:', err);
							const collection = client.db('music').collection('playlists');
							// Add the playlist to the queue if it exists
							collection.findOne({name: command.split(' ')[2]})
							.then(result => {
								if (result) {
									queue(message.guild).textChannel = message.channel;
									queue(message.guild).voiceConnection = connection;
									queue(message.guild).addPlaylist(command.split(' ')[2], result.songs);
								} else {
									message.channel.send({embed: {
										color: colors.error,
										description: 'No such playlist exists.'
									}});
								}
								client.close();
							});
						});
					});
				}
			}
		} else if (!message.guild) {
			return;
		} else if (command.split(' ')[0].toLowerCase() === 'play' && command.split(' ').length > 1) {
			// Play a song
			// Only try to join the sender's voice channel if they are in one themselves
			if (message.member.voiceChannel) {
				message.member.voiceChannel.join()
				.then(connection => {
					// Connection is an instance of VoiceConnection
					queue(message.guild).voiceConnection = connection;
					if (command.split(' ').length === 2 && isURL(command.split(' ')[1])) {
						queue(message.guild).textChannel = message.channel;
						queue(message.guild).add(command.substr(5));
					} else {
						let opts = {
							maxResults: 1,
							key: config.googleApiKey,
							type: 'video'
						}
						search(command.substr(5), opts, function(err, results) {
							if(err) return console.log(err);
							queue(message.guild).textChannel = message.channel;
							queue(message.guild).add([results[0].title, results[0].link]);
						});
					}
				})
				.catch(console.log);
			} else {
				message.channel.send({embed: {
					color: colors.error,
					description: 'You need to be in a voice channel first!'
				}});
			}
		} else if (command.toLowerCase() === 'repeat') {
			if (message.member.voiceChannel) {
				queue(message.guild).textChannel = message.channel;
				queue(message.guild).repeat();
			} else {
				message.channel.send({embed: {
					color: colors.error,
					description: 'You need to be in a voice channel first!'
				}});
			}
		} else if (command.toLowerCase() === 'pause') {
			if (message.member.voiceChannel) {
				queue(message.guild).pause();
				console.log('⏸ Paused');
			}
		} else if (command.toLowerCase() === 'resume') {
			if (message.member.voiceChannel) {
				queue(message.guild).resume();
				console.log('▶️ Resumed');
			} else {
				message.channel.send({embed: {
					color: colors.error,
					description: 'You need to be in a voice channel first!'
				}});
			}
		} else if (command.toLowerCase() === 'next') {
			if (message.member.voiceChannel) {
				queue(message.guild).textChannel = message.channel;
				queue(message.guild).jump(queue(message.guild).position+2);
			} else {
				message.channel.send({embed: {
					color: colors.error,
					description: 'You need to be in a voice channel first!'
				}});
			}
		} else if (command.toLowerCase() === 'previous') {
			if (message.member.voiceChannel) {
				queue(message.guild).textChannel = message.channel;
				queue(message.guild).jump(queue(message.guild).position);
			} else {
				message.channel.send({embed: {
					color: colors.error,
					description: 'You need to be in a voice channel first!'
				}});
			}
		} else if (command.split(' ')[0].toLowerCase() === 'jump' && !isNaN(command.substr(5)) && parseInt(command.substr(5)) > 0) {
			if (message.member.voiceChannel) {
				queue(message.guild).textChannel = message.channel;
				queue(message.guild).jump(parseInt(command.substr(5)));
			} else {
				message.channel.send({embed: {
					color: colors.error,
					description: 'You need to be in a voice channel first!'
				}});
			}
		} else if (command.split(' ')[0].toLowerCase() === 'remove') {
			let range = command.substr(7).split('|');
			range.forEach((item) => {item = parseInt(item)});
			if (!isNaN(range[0]) && ((range.length === 1) || (range.length === 2 && !isNaN(range[1])))) {
				if (message.member.voiceChannel) {
					if ((range[0] === queue(message.guild).position) || (range.length === 2 && Array.from({length: range[1]-range[0]}, (x, i) => i+range[0]-1).includes(queue(message.guild).position))) {
						message.channel.send({embed: {
							color: colors.error,
							description: "You can't remove the currently playing song!"
						}});
					}
					queue(message.guild).textChannel = message.channel;
					queue(message.guild).remove(range);
				} else {
					message.channel.send({embed: {
						color: colors.error,
						description: 'You need to be in a voice channel first!'
					}});
				}
			}
		} else if (command.toLowerCase() === 'shuffle') {
			if (message.member.voiceChannel) {
				queue(message.guild).textChannel = message.channel;
				queue(message.guild).shuffle(message);
			} else {
				message.channel.send({embed: {
					color: colors.error,
					description: 'You need to be in a voice channel first!'
				}});
			}
		} else if (command.toLowerCase() === 'queue') {
			queue(message.guild).textChannel = message.channel;
			queue(message.guild).showQueue();
		} else if (command.split(' ')[0].toLowerCase() === 'lyrics') {
			// Get the lyrics of the requested (or currently playing) song
			if (queue(message.guild).songs[queue(message.guild).position] || command.split(' ').length > 1) {
				let req = https.request({
					host: 'api.genius.com',
					path: '/search?q='+encodeURIComponent(command.length > 1?command.substring(7):queue(message.guild).songs[queue(message.guild).position][0]),
					headers: {'Authorization': `Bearer ${config.geniusApiKey}`}
				}, res => {
					res.setEncoding('utf8');
					var search_results = '';
					res.on('data', chunk => search_results += chunk);
					res.on('end', () => {
						// We now have the search results
						if (JSON.parse(search_results).response.hits.length >= 1) {
							// Atleast one result was found
							let req = https.request({
								host: 'genius.com',
								path: JSON.parse(search_results).response.hits[0].result.path
							}, res => {
								res.setEncoding('utf8');
								let result = '';
								res.on('data', chunk => result += chunk);
								res.on('end', () => {
									// We now have the lyrics page's content
									// We need to parse the content
									const $ = cheerio.load(result);
									message.channel.send({embed: {
										color: colors.status,
										author: {
											name: JSON.parse(search_results).response.hits[0].result.primary_artist.name,
											icon_url: JSON.parse(search_results).response.hits[0].result.primary_artist.image_url
										},
										title: `Lyrics of ${JSON.parse(search_results).response.hits[0].result.title_with_featured}`,
										description: $('.lyrics p').text().length >= 2048?$('.lyrics p').text().substr(0, 2045)+'...':$('.lyrics p').text()
									}}).catch(err => {
										console.log(err);
										message.channel.send({embed: {
											color: colors.error,
											description: `Error: ${err}`
										}});
									});
								});
							});
							req.on('error', e => message.channel.send({embed: {
								color: colors.error,
								description: `Error with request: ${e.message}`
							}}));
							req.end();
						} else {
							// No results were found
							message.channel.send({embed: {
								color: colors.error,
								description: "Couldn't find lyrics for this song!"
							}});
						}
					});
				});
				req.on('error', e => message.channel.send({embed: {
					color: colors.error,
					description: `Error with request: ${e.message}`
				}}));
				req.end();
			} else {
				message.channel.send({embed: {
					color: colors.error,
					description: 'No song is currently playing'
				}}).catch(err => console.log(`Error: ${err}`));
			}
		} else if (command.toLowerCase() === 'song') {
			queue(message.guild).textChannel = message.channel;
			queue(message.guild).song();
		} else if (command.toLowerCase() === 'stop') {
			if (message.member.voiceChannel) {
				if (queues[message.guild.id.toString()]) {
					queue(message.guild).position = queue(message.guild).songs.length;
					if (queue(message.guild).dispatcher)
						queue(message.guild).dispatcher.end();
					if (queue(message.guild).voiceConnection)
						queue(message.guild).voiceConnection.disconnect();
					delete queues[message.guild.id.toString];
				}
				message.react('🛑');
			} else {
				message.channel.send({embed: {
					color: colors.error,
					description: 'You need to be in a voice channel first!'
				}});
			}
		}
	}
});
