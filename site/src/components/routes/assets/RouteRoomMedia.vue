
<template lang='pug'>

div
    v-list
        route-room-media-item(v-for='item of media' :item='item' :key='item.id')

    v-divider

    div.add(v-if='!deny_dj')
        v-btn(@click='yt_show_dialog' text color='primary') Add Youtube
        v-btn(v-if='false' text color='primary') Add Text / Image

    //- NOTE Using both v-if and v-model so dialog and fields are fresh on each open
    v-dialog(v-if='yt_dialog' v-model='yt_dialog')
        v-card
            v-card-title Add Youtube Video
            v-card-text
                v-text-field(v-model='yt_id' :rules='[yt_validate_id]' label="Youtube URL (or ID)"
                    spellcheck='false' autofocus)
                v-text-field(v-model='yt_name' label="Name of video")
                app-youtube(:video_id='yt_id_debounced' :class='{invisible: !yt_id_debounced}')
            v-card-actions
                v-btn(@click='yt_dialog = false' text color='primary') Cancel
                v-btn(@click='yt_add' :disabled='!yt_valid' text color='primary') Add

</template>


<script lang='ts'>

import {Component, Vue, Prop, Watch} from 'vue-property-decorator'

import {debounce_method} from '@/services/misc'
import app_config from '@/app_config.json'
import AppYoutube from '@/components/reuseable/AppYoutube.vue'
import RouteRoomMediaItem from './RouteRoomMediaItem.vue'


@Component({
    components: {AppYoutube, RouteRoomMediaItem},
})
export default class extends Vue {

    yt_dialog = false
    yt_name = ''
    yt_id = ''
    yt_id_debounced = ''

    get deny_dj(){
        return this.$store.getters.deny_dj
    }

    get media(){
        return this.$store.state.tmp.room.media
    }

    get loaded(){
        return this.$store.state.tmp.room.loaded
    }

    // YOUTUBE

    get yt_valid(){
        // Whether the current input is valid and can be submitted
        return this.yt_validate_id(this.yt_id)
    }

    @Watch('yt_id') @debounce_method(1000) watch_yt_id_debounced(value){
        // Update parsed & debounced version of yt_id for use in showing a preview
        this.yt_id_debounced = this.yt_parse_id(value)
    }

    @Watch('yt_dialog') watch_yt_dialog(){
        // Reset input whenever dialog opened
        this.yt_name = ''
        this.yt_id = ''
    }

    yt_show_dialog(){
        // Show dialog for adding a Youtube video
        if (app_config.domain === 'singit.cloud'){
            if (this.$store.state.singit_paid === false){
                // Can't add any more videos until paid
                this.$store.dispatch('show_dialog', 'fund-singit')
                return
            } else if (this.$store.state.singit_paid === null){
                // One free add allowed
                this.$store.commit('dict_set', ['singit_paid', false])
            }
        }
        this.yt_dialog = true
    }

    yt_parse_id(id){
        // Return Youtube id from given input which may be an id or a URL
        id = id.trim()
        if (id.startsWith('http:') || id.startsWith('https:')){
            // Dealing with a URL
            const url = new URL(id)
            if (url.hostname.endsWith('youtube.com')){
                return url.searchParams.get('v')
            } else if (url.hostname.endsWith('youtu.be')){
                return url.pathname.split('/')[1]
            } else {
                return null
            }
        }
        return id
    }

    yt_validate_id(id){
        // Return whether Youtube id is valid (don't know rules so just check not a broken link)
        try {
            id = this.yt_parse_id(id)
        } catch {
            return false
        }
        return !!id && !id.includes('/')
    }

    yt_add(){
        // Add the video to media list
        const id = this.yt_parse_id(this.yt_id)
        const name = this.yt_name.trim() || `Video (${id})`
        this.$store.dispatch('media_add_youtube', [name, id])
        this.yt_dialog = false
    }

}

</script>


<style lang='sass' scoped>



.v-list
    // Make list take up space and scroll if needed
    flex-grow: 1
    overflow-y: auto


.v-divider
    margin: 0  // spacing handled by other elements


.add
    // Center add buttons and provide spacing
    margin: 12px 0
    display: flex
    justify-content: space-around


#youtube
    // Grow with width approximately always bit less than dialog width (works until dialog max width)
    width: 70vw
    height: calc(70vw / 16 * 9)
    // Prevent from exceeding max dialog width (regardless of viewport width)
    max-width: 552px
    max-height: calc(552px / 16 * 9)
    // Center
    margin: 0 auto


// Give media list a max-height if inside a panel (as panel has no fixed height, unlike tab)
@at-root .v-expansion-panel .v-list
    max-height: 400px


</style>
