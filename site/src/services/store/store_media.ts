
export {getters_ as getters}
const getters_ = {

    paused(state){
        // Return whether playback of media is actively paused (or no media loaded)
        //      playing/future-play/buffering/finished are all considered "playing" for this
        //      Determining any of those MUST be calc'd in component
        //      As they rely on time which changes every ms, and must be checked infrequently
        // NOTE If this is false then room.start is gauranteed to exist and be non-null
        return (state.tmp.room?.start || null) === null
    },

}


export function actions(db, api){return {

    media_add_youtube({state}, [name, id]){
        // Add a youtube video to the playlist
        api.send('room_media_add', {
            room_id: state.tmp.room.id,
            media_name: name,
            media_type: 'youtube',
            media_content: {id},
        })
    },

    media_rearrange({state}, [before_id, after_id]){
        // Rearrange media items so that `before` is before `after`
        api.send('room_media_rearrange', {
            room_id: state.tmp.room.id,
            media_id: before_id,
            media_id_after: after_id,
        })
    },

    media_load({state}, id){
        // Load the media item with given id
        api.send('room_media_load', {
            room_id: state.tmp.room.id,
            media_id: id,
        })
    },

    media_play({state, getters}, duration){
        // Play the current media item starting at given duration
        api.send('room_media_play', {
            room_id: state.tmp.room.id,
            room_start: getters.get_server_time() - duration,
        })
    },

    media_pause({state}, duration){
        // Pause the current media item at the given duration
        api.send('room_media_pause', {
            room_id: state.tmp.room.id,
            room_paused: duration,
        })
    },

    media_pause_now({dispatch, getters, state}){
        // Pause at the current duration (even if larger than video length, but min 0)
        const duration = getters.get_server_time() - state.tmp.room.start
        dispatch('media_pause', Math.max(0, duration))
    },

    media_play_resume({dispatch, state}){
        // Resume playback from current paused position BUT subtract a few secs
        // This accounts for: network delay, buffering, and helps remind what last heard
        // NOTE If upcoming (paused null) then play from start
        const start = state.tmp.room.paused || 0
        const subtract_secs = 3
        dispatch('media_play', start - subtract_secs)
    },

    media_remove({state}, id){
        // Remove the media item with given id
        api.send('room_media_remove', {
            room_id: state.tmp.room.id,
            media_id: id,
        })
    },

    media_next({dispatch, state}){
        // Load the next media item
        const next = state.tmp.room.media[state.tmp.room.loaded + 1]
        if (!next){
            return
        }
        dispatch('media_load', next.id)
    },

}}
