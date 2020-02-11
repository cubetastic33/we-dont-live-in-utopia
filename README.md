# We don't live in utopia

My first Discord Bot

### Supported commands

The currently supported commands are `help`, `ping`, `playlist`, `play`, `repeat`, `pause`, `resume`, `next`, `previous`, `jump`, `remove`, `shuffle`, `queue`, `lyrics`, `song`, and `stop`.

### Command info

`help`: Display this help message

`ping`: I'll respond with pong

`playlist`: Create, play and modify playlists

`play <url/query>`: Play the audio from the YouTube video url or the first video result with the search query

`repeat`: Repeat the currently playing song

`pause`: Pause the currently playing song

`resume`: Resume if the song is paused

`next`: Play the next song in the queue

`previous`: Play the previous track in the queue

`jump <to>`: Jump to a track in the queue

`remove <start(|end)>`: Remove a track, or specify 2 numbers separated with | to remove a range of tracks

`shuffle`: Shuffle the queue

`queue`: Display the queue

`lyrics (<query>)`: Display the lyrics for the currently playing song, or the given query

`song`: Display the currently playing song

`stop`: Stop the currently playing song, clear the queue, and exit the voice channel

### Playlists

`playlist create <name> <list of|songs you|want to|add>`: Create a playlist of the given name with the given songs. The songs should be separated with |.

`playlist play <name>`: Add the playlist to the queue