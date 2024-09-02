live at: [clownpoker.net](https://clownpoker.net)

Create a poker lobby and send the link to your friends! Supports up to 10 players. Includes Texas Hold'em with optional modifiers: the seven-deuce game and the [modified stand up game](https://www.pokerchipforum.com/threads/nit-buttons-variation-of-the-stand-up-game.101815/page-2#post-2128181). Supports all poker functions: dealing, betting, timers, live chat, ledger, win probabilities, etc.

Allows users to create a poker lobby and send the link to play with others online. Poker logic coded from scratch. Server takes and sends single messages, like player 0 raise 50, unique id:928fsieo. New users or users rejoining get all the requests that are appropriate for them. Some messages will be hidden to some users because they reveal card data. Users can only spoof other players’ messages if they have their unique ID, which is stored only on the server and client browser. All logic is in game_logic, which is used by both frontend and backend to run actions.

