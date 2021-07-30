
<template lang='pug'>

div
    v-slider.scrubber(v-model='scrubber_value' :max='scrubber_max' :disabled='scrubber_disabled'
        :loading='scrubber_loading' :readonly='scrubber_readonly' @start='scrubber_drag_start'
        @end='scrubber_drag_end' hide-details)

    v-toolbar

        span.all All
        v-btn(@click='control' :disabled='control_disabled' :title='control_title' icon)
            app-svg(:name='control_icon')
        span.status {{ status_string }}

        v-spacer
        v-divider(vertical)

        span.you You
        v-btn(@click='toggle_mute' icon)
            app-svg(:name='volume_icon')
        //- Hide details as they affect layout by adding space for errors below slider
        v-slider.volume(v-model='volume' hide-details)
        v-btn(v-if='fullscreen_supported' @click='request_fullscreen' icon)
            app-svg(name='icon_fullscreen')

</template>


<script lang='ts'>

import {Component, Vue, Prop, Watch} from 'vue-property-decorator'

import {display_seconds} from '@/services/utils'


@Component({})
export default class extends Vue {

    @Prop() status

    get status_string(){
        // A status string to display to the user

        // If playlist empty then status will be null
        if (!this.status){
            return ''
        }

        // If status exists but duration is null then playback is upcoming
        if (this.status.duration === null){
            return "Upcoming"
        }

        // If length is not known yet then player isn't ready yet and meaningless to display
        //     duration as could far exceed length if wasn't paused after finishing
        if (this.status.length === null){
            return 'Loading...'
        }

        // Both duration and length is known, so display them
        let s = display_seconds(this.status.duration) + ' / ' + display_seconds(this.status.length)
        if (this.$store.state.debug && this.status.debug){
            const diff = this.$store.state.tmp.time_diff
            const diff_lat = this.$store.state.tmp.time_diff_latency
            s += ` [${this.status.debug}, diff ${diff} lat ${diff_lat}]`
        }
        return s
    }

    get deny_dj(){
        return this.$store.getters.deny_dj
    }

    get no_media(){
        return !this.$store.state.tmp.room.media.length
    }

    // SCRUBBER

    scrubber_frozen = null  // Stores scrubber value from drag start

    get scrubber_value(){
        // Return duration in ms
        let value
        if (this.scrubber_frozen !== null){
            // Scrubber value is frozen, so return that rather than latest duration
            value = this.scrubber_frozen
        } else {
            // Return duration in ms
            // WARN v-slider moves in integers, so using seconds results in only moving per second
            value = (this.status?.duration || 0) * 1000
        }

        // Ensure value is valid, otherwise will trigger `set`s and play position changes
        // WARN Must floor as slider only works with integers
        // WARN value may be greater than max if length not known yet
        return Math.max(Math.min(Math.floor(value), this.scrubber_max), 0)
    }

    set scrubber_value(ms){
        // Request play at given ms

        // Don't set if currently dragging (will set when released)
        if (this.scrubber_frozen){
            return
        }

        this.$store.dispatch('media_play', ms / 1000)
    }

    get scrubber_max(){
        // Return length in ms
        return (this.status?.length || 0) * 1000
    }

    get scrubber_disabled(){
        // Scrubber disabled (no progress displayed) if no duration (empty playlist / text item)
        return !this.status || this.status.duration === null
    }

    get scrubber_loading(){
        // Scrubber loading if duration known but length still unknown (player not ready)
        // NOTE v-slider's loading takes priority over its disabled
        return this.status && this.status.duration !== null && this.status.length === null
    }

    get scrubber_readonly(){
        // Scrubber readonly if no dj permission
        return this.deny_dj
    }

    scrubber_drag_start(value){
        // Freeze slider value when dragging so slider button stays with the cursor
        this.scrubber_frozen = value
    }

    scrubber_drag_end(value){
        // Finished drag so unfreeze and set the final value
        // NOTE v-slider does NOT emit value after this is called (no duplication)
        this.scrubber_frozen = null
        this.scrubber_value = value
    }

    // CONTROL BUTTON

    get control_disabled(){
        // Control button is disabled if empty playlist or status says so
        return !this.status || this.status.control_disabled
    }

    get control_title(){
        // Show a message about being admin if denied dj permission (NOT for all disabled cases)
        return this.deny_dj ? "Only admins can control what is played" : ""
    }

    get control_icon(){
        // Show control icon, or (disabled) play arrow if playlist empty
        return this.status ? this.status.control_icon : 'icon_play_arrow'
    }

    control(){
        // Do control action
        this.$store.dispatch(this.status.control_action)
    }

    // VOLUME

    get volume(){
        return this.$store.state.volume
    }

    set volume(val){
        this.$store.commit('dict_set', ['volume', val])
    }

    get volume_icon(){
        // Return icon that matches the current volume state
        if (this.volume === 0){
            return 'icon_volume_off'
        }
        return this.volume > 50 ? 'icon_volume_up' : 'icon_volume_down'
    }

    toggle_mute(){
        // Mute (or unmute if already muted with a cautious 50%)
        this.volume = this.volume === 0 ? 50 : 0
    }

    // FULLSCREEN

    get fullscreen_supported(){
        // Whether fullscreen API is supported/allowed
        return self.document.fullscreenEnabled === true
    }

    request_fullscreen(){
        // Request for the media component to be displayed fullscreen
        self.document.querySelector('#media').requestFullscreen({navigationUI: 'hide'})
    }

}

</script>


<style lang='sass' scoped>

.scrubber
    // Place scrubber on top edge of controls toolbar with no own space
    margin-top: -16px
    margin-bottom: -16px
    // Make scrubber appear above adjacent elements
    position: relative
    z-index: 10

    ::v-deep
        .v-slider
            // Make bar touch edges of screen
            margin: 0

            // Don't show thumb if can't control
            &.v-slider--readonly .v-slider__thumb-container
                display: none

        .v-progress-linear
            // Fix position (due to margin hack)
            top: auto

.all, .you
    font-size: 12px
    opacity: 0.7
    font-weight: 500

.volume
    max-width: 250px  // Not necessary to be any longer than this
    flex-grow: 999  // Don't let spacer take any space unless hit max-width (width:100% wraps text)

.status
    font-size: 12px

.v-divider
    align-self: auto  // fix positioning
    margin: 0 12px

</style>
