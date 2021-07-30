
<template lang='pug'>

div.root

    div(class='text-center')
        app-contact-dialog(v-model='contact_dialog_show')
        v-btn(@click='contact_dialog_show = true' text color='primary') Contact Us

    h1 The basics

    h2 How it works
    p When singing online there are two causes for lag/delays:
    ol
        li The delay for the video to travel from the host to the guests
        li The delay for guests' voices to reach each other
    p {{name}} eliminates the first one, so that there is virtually no delay between when each guest hears the video. There is still a delay for voices to travel, as it is impossible to eliminate that. So if any guests have a slow Internet connection it may still not be possible to sing together (but see tips below).

    h2 How to Use
    ol
        li All guests must be in a {{name}} room AND a voice call
            ul
                li We recommend Zoom (but any voice/video call will do)
        li Add songs from Youtube (preferably with lyrics and vocals)
        li Play the video and it will play for everyone

    h1 Most important tips

    h2 Use earphones
    p When you are in a video call (such as Zoom) you must ensure that your microphone cannot hear the video, otherwise your friends will hear an echo of the video from you. You can either:
    ol
        li Wear earphones (stops your microphone from hearing the video)
        li Go on mute (while the video is playing)

    h2 Sing in time to the video
    p Do not sing in time to other guests as their voices will always be slightly delayed. If you sing in time to them then they will hear your voice even more delayed than before.

    h1 Other tips

    h2 Use videos that already have vocals
    p Trying to sing along together to an instrumental track will be more difficult than if there is already a prerecorded singer in the video, as they will set the pace even if guests' voices are delayed.

    h2 Make video volume louder than voices
    p Have the video volume as slightly louder than the voice call, so that guests' voices are in the background and less distracting if slightly delayed.

    h2 Use mute to take a break
    p If you need silence for a moment, use the mute button. Usually most people would pause the video, but if you do this it will pause for everyone (not just you).

    h2 Slower-paced songs will sound better
    p There is always some delay in voices, but these will be less noticable with songs that are slow paced with drawn out words.
    p We haven't tried, but we assume trying to rap together is next to impossible, as the lyrics are too fast paced, sorry :)

    h2 Mute guests with slow connections
    p If there are one or two guests who's voices are heard later than all others, they likely have slow internet connections. It is best to put them on mute (in the video call), and they will still be able to hear others voices even if so.

    h2 Only need earphones for {{name}}
    p If you are using two different devices, one for the voice call and the other for {{name}}, only {{name}} needs earphones. You don't need earphones for both.

    h2 How to use with multiple people physically present
    p If more than one person is using a single device then those people will either need to share earphones or go on mute. A couple can use one earbud each of earphones, or you can purchase a splitter that allows you to connect two earphones to one audio socket. This could potentially allow four people to listen if you give them one earbud each :)

    h2 You don't need earphones if not singing
    p If you are watching a video together in silence, there is no need to wear earphones. Just put everyone on mute while the video is playing and resume talking after it is done.

    h2 How to know it is working
    p It is very easy to confirm the app is working. Simply create a room and connect to it from two different devices (such as a laptop and a phone, or even just two browser tabs). Play the video and after some seconds of syncing, they should play at almost the exact same time.

    h1 Audio problems

    h2 Can hear the video playing on another guest's device
    p That person must wear earphones or go on mute.
    p <strong>Why?</strong> When any sound comes out of your computer your microphone will record it and send it as if it were your voice. Most video call apps (such as Zoom) are smart in that when you share a video through them, they know to filter that sound out when you are speaking so there isn't an echo. Since {{name}} is external to video call apps, they don't know to filter it out.

    h2 Video keeps jumping
    p This is normal during the first 5-20 seconds of the video while the app keeps it in sync. If it continues for longer than that you may have a slow internet connection, or it is possible there is a problem with the app (let us know).

    h1 Compared to other tools

    h2 {{name}} has the least delay in video sharing
    p There was no tool we tested that played videos in sync as well as {{name}} does. Most played videos 1-2 seconds out of time. {{name}} plays them usually within 0-100ms (1/10 of a second).


</template>


<script lang='ts'>

import {Component, Vue, Prop} from 'vue-property-decorator'

import app_config from '@/app_config.json'
import AppContactDialog from '@/components/reuseable/AppContactDialog.vue'


@Component({
    components: {AppContactDialog},
})
export default class extends Vue {
    contact_dialog_show = false
    name = app_config.name
}

</script>


<style lang='sass' scoped>


// NOTE Help is last panel so no max-height necessary


.root
    padding: 18px
    overflow-y: auto

h1
    color: $primary_darker  // Works best for both themes
    font-size: 24px

h2
    color: $primary_darker
    font-size: 16px

h1, h2
    margin: 12px 0 6px 0

p
    margin: 6px 0


</style>
