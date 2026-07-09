// roomId: { 
// id
// topic
// isPrivate (future: to show available public rooms)
// players: [ { id, name, score, status (LOBBY, INGAME), isOnline } ]
// status [(WAITING, RUNNING)]
// hostId
// }
export const rooms = new Map();
