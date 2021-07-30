
<template lang='pug'>

div
    div.unstarted(v-if='show_click_prompt') Click video to begin watching
    //- Always keep iframe in DOM, so just change class to make invisible
    app-youtube(:video_id='content.id' hide_controls
        :class='{started: yt_started, playing: status.state === "playing"}')

    div.not-playing(v-if='status.state !== "playing"' @click='not_playing_interaction'
            :style='not_playing_styles' :class='{disabled: status.control_disabled}')
        div.error-msg(v-if='status.state === "error"')
            app-svg(name='icon_error')
            | {{ yt_error }}
        div.countdown(v-else-if='status.countdown') {{ Math.floor(status.countdown) }}
        app-svg.status-icon(v-else :name='status.control_icon')

</template>


<script lang='ts'>

import {Component, Vue, Prop, Watch} from 'vue-property-decorator'

import AppYoutube from '@/components/reuseable/AppYoutube.vue'
import {display_seconds, install_env} from '@/services/utils'
import {debug} from '@/services/misc'


// Values to help guide the sync algorithm, and guard against being thrown off by abnormalities
const SYNC_ADDITION_DEFAULT = 0.2  // Usual range is roughly 100-300ms (seen so far)
const SYNC_ADDITION_MAX = 1  // Haven't seen successful value go higher than ~600ms (so far)


// tslint:disable:object-literal-key-quotes
const YOUTUBE_STATUS_CODES = {
    '-1': 'unstarted',  // Video has not started yet (mobile users require manual click to begin)
    '0': 'ended',
    '1': 'playing',
    '2': 'paused',
    '3': 'buffering',  // When trying to play but stopped to buffer
    '5': 'cued',  // Video is ready to begin playing
}
const YOUTUBE_ERROR_CODES = {
    '2': "Video ID invalid (change the ID in playlist settings)",
    '5': "Video cannot be played in this app",
    '100': "Video no longer exists or is private",
    '101': "Video not allowed to be played outside of Youtube",
    '150': "Video not allowed to be played outside of Youtube",
}
// tslint:enable:object-literal-key-quotes


@Component({
    components: {AppYoutube},
})
export default class extends Vue {

    // IDs for setInterval tasks so can clear before component destroyed
    interval_status
    interval_sync

    // Player relevant
    player  // Instance of Youtube API for the Youtube iframe
    player_ready  // Whether player instance is ready to be interacted with
    seek_count = 0  // How many times sync has tried to seek to result in being in sync
    last_addition = SYNC_ADDITION_DEFAULT  // What last sync addition was
    last_sync_result = ''  // A debug string of last known sync result (addition -> diff)
    yt_started = false  // Set USUALLY only once to true when video no longer `unstarted`
    yt_error = null  // The error msg if a Youtube error has occured

    // Status (throttled; also emitted for rest of app to know)
    status = null  // Init'd during `created`

    @Prop() content

    created(){
        // Component instance created event

        // Load the Youtube API if haven't yet
        // NOTE Don't want to do this unless actually needed, hence in this component
        // WARN src is actually just code to download another script, so can't rely on load event
        if (!self._youtube_api_load){

            // Create a promise that is resolved when Youtube's API calls `onYouTubeIframeAPIReady`
            // WARN Even if `YT` exists, `YT.Player` may not yet, but will when above called
            self._youtube_api_load = new Promise(resolve => {
                self.onYouTubeIframeAPIReady = resolve
            })

            // Load the script
            const script = self.document.createElement('script')
            script.src = 'https://www.youtube.com/iframe_api'
            self.document.head.appendChild(script)
        }

        // Once Youtube API loaded (or if loaded already) init the player instance
        self._youtube_api_load.then(() => {
            this.init_player()
        })

        // Set status and regularly update it
        // NOTE Will change every ms as time-based, and updates not heavy so can run very often
        this.update_status()
        this.interval_status = setInterval(this.update_status, 200)

        // Do initial sync and repeat regularly
        // NOTE Do not do often as seeking a lot may stop video from playing (needs time to buffer)
        //      Also it will already be called for every player status change as well
        this.sync()
        this.interval_sync = setInterval(this.sync, 5000)
    }

    beforeDestroy(){
        // Clear intervals
        clearInterval(this.interval_status)
        clearInterval(this.interval_sync)
    }

    get room(){
        return this.$store.state.tmp.room
    }

    get is_last(){
        // Whether this media item is the last in the playlist
        return this.room.loaded === this.room.media.length - 1
    }

    get not_playing_styles(){
        // Dynamic styles to apply to not-playing placeholder
        return {
            // WARN maxresdefault.jpg not always available (confirmed myself)
            //      and can't fallback on others as Youtube still serves a valid placeholder image
            'background-image': `url(https://img.youtube.com/vi/${this.content.id}/hqdefault.jpg)`,
        }
    }

    get show_click_prompt(){
        // Whether to show message to prompt user to click video to begin (required on mobile)
        return install_env !== 'desktop' && this.status.state === "playing" && !this.yt_started
    }

    @Watch('content.id') watch_content_id(){
        // Reset error whenever changing video
        this.yt_error = null
    }

    @Watch('room.start') watch_room_start(){
        // Do immediate status update if start value changes
        // NOTE Not watching `paused` as 99% of time will change when start also changes
        this.update_status()
    }

    @Watch('status') watch_status(){
        // Emit status whenever it changes
        this.$emit('status', this.status)
    }

    @Watch('status.state') watch_status_state(){
        // Need to sync when state changes to trigger play/pause of player immediately
        this.sync()
        // Whenever start playing, reset sync properties for more accurate seeking
        if (this.status.state === 'playing'){
            this.seek_count = 0
            this.last_addition = SYNC_ADDITION_DEFAULT
            this.last_sync_result = ''
        }
    }

    @Watch('$store.state.volume') watch_volume(to, from){
        // Tell player what volume to set whenever it changes
        // NOTE Also set when player first ready in onReady handler
        if (this.player_ready){
            this.player.setVolume(to)
        }
    }

    not_playing_interaction(){
        // Do control action when not-playing overlay clicked
        if (!this.status.control_disabled){
            this.$store.dispatch(this.status.control_action)
        }
    }

    init_player(){
        // Init instance of Player so can control video via iframe
        this.player = new self.YT.Player('youtube', {
            events: {
                onReady: event => {
                    // NOTE Won't be able to interact with player instance until it's ready
                    this.player_ready = true
                    // Set volume
                    this.player.setVolume(this.$store.state.volume)
                    // Trigger buffering of video and enable seeking while paused
                    //     Pausing has no effect until first play
                    //     If not technically paused (just cued) then seek will trigger play
                    //     So must play & pause & then can seek while paused without triggering play
                    // NOTE repause happens in `onStateChange` when first started
                    this.player.playVideo()
                },
                onStateChange: event => {
                    // These events don't appear to be emitted very reliably
                    // Also emitted very rapidly when buffering (switches between 1 and 3)
                    // So not syncing or doing anything and relying on intervals instead
                    // BUT is useful for immediate catch of `started` event (leaving `unstarted`)
                    // WARN For some reason videos can go from unstarted->buffering->unstarted
                    //      .'. Ignoring buffering when it comes to knowing if started yet
                    const status = YOUTUBE_STATUS_CODES[event.data]
                    if (!this.yt_started && !['unstarted', 'buffering'].includes(status)){
                        this.yt_started = true
                        // Pause as initial play is to trigger buffering (sync will play if needed)
                        this.player.pauseVideo()
                        // Update straight away (rather than wait for next intervals)
                        this.update_status()
                        this.sync()
                    }
                },
                onError: event => {
                    this.yt_error = YOUTUBE_ERROR_CODES[event.data] || "An error occured"
                    this.update_status()
                },
            },
        })
    }

    update_status(){
        // Update status
        // NOTE Some parts rely on time, so called both immediately and periodically
        // NOTE Also used to determine Player's status as Youtube doesn't emit events reliably
        // WARN Call manually if need instant update (such as with `player_ready` and `yt_error`)
        const status:any = {}

        // Do nothing if have left room (possible as this is executed async)
        if (!this.room){
            return
        }

        // Determine the video length if known
        // NOTE Youtube's use of "duration" refers to video length (rather than current time)
        status.length = this.player_ready ? this.player.getDuration() : null

        // Determine if paused/upcoming/ended/playing
        status.countdown = null
        if (this.room.paused !== null){
            // Duration is the paused value
            status.state = 'paused'
            status.duration = this.room.paused
        } else {
            // Work out duration from start timestamp
            status.duration = this.$store.getters.get_server_time() - this.room.start
            if (status.duration < 0){
                // Duration is negative so convert to a countdown
                status.state = 'upcoming'
                status.countdown = Math.abs(status.duration)
                status.duration = null
            } else if (status.length && status.duration >= status.length){
                // Video has finished
                status.state = 'ended'
            } else {
                status.state = 'playing'
            }
        }

        // Max duration at video length if known
        // NOTE Safer to do this after working out state etc (applies to both paused & ended)
        if (status.length && status.duration > status.length){
            status.duration = status.length
        }

        // Override state if Youtube has reported an error and we are trying to play
        // NOTE Playing states are technically all except 'paused'
        // NOTE Ignore error if upcoming as video may not have been published yet, hence the error
        // NOTE Do show error even if ended as a dud Youtube video may have a length of 0!
        if (this.yt_error && ['playing', 'ended'].includes(status.state)){
            status.state = 'error'
        }

        // Set control action attributes
        status.control_disabled = false
        if (status.state === 'playing'){
            status.control_action = 'media_pause_now'
            status.control_icon = 'icon_pause'
        } else if (['paused', 'upcoming'].includes(status.state)){
            status.control_action = 'media_play_resume'
            status.control_icon = 'icon_play_arrow'
        } else if (['ended', 'error'].includes(status.state)){
            status.control_action = 'media_next'
            status.control_icon = 'icon_skip_next'
            status.control_disabled = this.is_last
        }

        // Override control disabled if no dj permission
        if (this.$store.getters.deny_dj){
            status.control_disabled = true
        }

        // Attach debug info
        status.debug = `${this.seek_count} seeks, ${this.last_sync_result}`

        // Update whole status in one go
        this.status = status
    }

    sync(){
        // Ensure the video is in sync with expected duration
        // NOTE This must be run regularly as many factors can make the video out of sync
        //      Such as: network failure, buffering, manual controlling, etc
        // WARN Don't run too regularly or video won't be able to buffer/play properly

        // Do nothing if have left room (possible as this is executed async)
        if (!this.room){
            return
        }

        // Can't do anything until player ready
        if (!this.player_ready){
            return
        }

        // Is possible for video to revert to 'unstarted' state and require manual click on mobile
        // So ensure not disabling clicks if that happens! (happened once during manual testing)
        const youtube_state = YOUTUBE_STATUS_CODES[this.player.getPlayerState()]
        this.yt_started = youtube_state !== 'unstarted'

        // Syncing pointless until video has "started" (as in not `unstarted`)
        if (!this.yt_started){
            return
        }

        // Work out what duration (current time) the video should be at right now
        // WARN Don't rely on throlled attributes as they are, well, throttled!
        let duration = this.room.paused
        if (this.room.start){
            duration = this.$store.getters.get_server_time() - this.room.start
        }

        // If video upcoming or should have ended, just ensure paused
        if (duration < 0 || duration > this.player.getDuration()){
            if (youtube_state === 'playing'){
                debug('PLAYER pause')
                this.player.pauseVideo()
            }
            return
        }

        // Work out difference between player's duration and expected duration
        // NOTE diff positive if player ahead of expected time (i.e. due to addition factor)
        const player_duration = this.player.getCurrentTime()
        const diff = player_duration - duration

        // Report current diff and what addition led to it (addition won't change unless new seek)
        const display_ms = num => Math.floor(num * 1000) + 'ms'
        this.last_sync_result = `${display_ms(this.last_addition)} -> ${display_ms(diff)}`

        // Calculate an acceptable diff (becoming more leniant the longer it takes to sync)
        // Some clients may suffer from frequent buffering which would throw out all calculations
        //     In which case must be more leniant on them or video will be jumpy the whole duration
        // WARN seek_count will initially be zero (hence +1)
        // NOTE Increases by 20ms every seek (5 secs) maxing out at 200ms (after 50 seconds)
        const acceptable_diff = Math.min(20 * (this.seek_count + 1), 200) / 1000  // Result is secs

        // Determine if "in sync"
        // NOTE Value of synced is the diff if acceptable, or null if not acceptable/synced
        // NOTE Convert to positive number to test against acceptable_diff but still preserve sign
        const synced = Math.abs(diff) <= acceptable_diff ? diff : null

        // Report synced value and action will decide if has changed
        this.$store.dispatch('client_synced', synced)

        // Seek to expected duration if current one is too far off the mark
        // NOTE Shouldn't matter if player is paused or playing
        if (synced === null){

            // Add additional time to account for lag when seeking, so end up at correct time
            // Base the additional time on what was last tried and how far off it was
            let addition = this.last_addition - diff
            if (addition < 0){
                // Addition cannot be negative as impossible for lag to ever be negative
                // Abnormal value, so try half way between the default and zero
                addition = SYNC_ADDITION_DEFAULT / 2
            } else if (addition > SYNC_ADDITION_MAX){
                // If trying to add more than the max then probably suffering from network issues
                // Most likely due to buffering for a long time due to first load or network pause
                // Network issue will probably resolve itself, so don't estimate too high
                // or will end up being too far ahead (so just aim between default and max)
                addition = SYNC_ADDITION_DEFAULT + (SYNC_ADDITION_MAX - SYNC_ADDITION_DEFAULT) / 2
            }

            // Seek to the duration expected to result in being in sync despite seek lag
            debug('PLAYER seek')
            this.player.seekTo(duration + addition, true)  // true = seek even if have to buffer
            this.seek_count += 1
            this.last_addition = addition
        }

        // Play video if meant to be playing and currently paused
        if (!this.$store.getters.paused && youtube_state !== 'playing'){
            debug('PLAYER play')
            this.player.playVideo()
        }

        // Pause video if meant to be paused and currently playing
        if (this.$store.getters.paused && youtube_state === 'playing'){
            debug('PLAYER pause')
            this.player.pauseVideo()
        }
    }

}

</script>


<style lang='sass' scoped>

.unstarted
    // Show message in top-left over video
    position: absolute
    margin: 12px
    padding: 12px
    border-radius: 6px
    font-size: 18px
    font-weight: 500
    color: $accent_lighter
    background-color: #000c
    pointer-events: none  // Allow clicks to pass through this onto video

#youtube, .not-playing
    // Fill container which already has correct 16:9 dimensions
    flex-grow: 1

#youtube:not(.playing)
        // Youtube shows controls and video suggestions whenever not actively playing
        // Would be nice to show still if paused, but Youtube blocks with suggestions anyway
        visibility: hidden
        position: absolute  // Move out of way for icons while invisible

#youtube.started
    // Prevent user from interacting with iframe (e.g. clicking to play/pause)
    // WARN Do NOT apply if video `unstarted` as mobile users won't be able to click to activate
    // NOTE While could capture presses to trigger a pause, better not to as too easy to
    //      accidentally press, especially while fullscreen and mobile
    pointer-events: none

.not-playing
    display: flex
    align-items: center
    justify-content: center
    cursor: pointer

    // Background image (which is set dynamically)
    // NOTE Some videos/images have black bars Youtube auto-crops during playback, so cover best
    background-size: cover
    background-position: center

    .error-msg
        display: flex
        margin: 12px
        padding: 12px
        border-radius: 6px
        background-color: $error
        color: $on_error
        font-weight: 500

        svg
            margin-right: 12px

    .countdown
        color: $accent
        opacity: 0.8
        font-size: 15vw
        font-weight: bold

    .status-icon
        width: 20vw
        height: 20vw
        max-width: 140px
        color: $primary
        stroke: $primary_darker
        stroke-width: 0.8
        stroke-linejoin: round

    &.disabled
        cursor: auto

        .status-icon
            color: rgba(#000, 0.5)
            stroke: transparent


</style>
