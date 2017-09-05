
const USER_SIGNED_OUT_MESSAGE = 'user signed out or failed to sign in...'
const USER_SIGNED_IN_MESSAGE = ' user signed in...'
const MAX_FRIEND_FEED_COUNT = 200
let user = {};
const TABLE_LOG_ENTRIES = "log_entries"
let DEBUG = true

let LOG = function (x) {
    if (DEBUG) {
        if (console) {
            console.log(x)
        }
    }
}

function getTextValue(inputId) {
    var element = document.getElementById(inputId)
    return element.value
}

function getFirstProp(obj) {
    if (obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                return key
            }
        }
    }

    return null
}

//*****************end of setup firebase

//***********************************************
//
//   Knockout Model Setup
//
//***********************************************
var model;

function MyModel(){
    var self = this;

    self.Feed = ko.observableArray()
    self.User = ko.observable()
    self.CurrentView = ko.observable("main")
    self.SignedIn = ko.observable(false)
    self.Title = ko.observable("dekarat")
    self.Message = ko.observable("")
    self.SearchEmail = ko.observable("")
    self.SearchResults = ko.observableArray()
    self.FriendRequests = ko.observableArray([])
    self.FriendsFeed = ko.observableArray([])
    self.HasRequests = ko.observable(false)
    self.Friends = ko.observableArray([])
    self.FriendsCount = ko.observable(0)

    self.acceptFriendRequest = function (friendRequest) {

        approveOrRejectFriendRequest(true, friendRequest)
        Materialize.toast("You are now friends with " + friendRequest.userTag, 2000, 'green')
    }

    self.rejectFriendRequest = function (friendRequest) {

        approveOrRejectFriendRequest(false, friendRequest)
        Materialize.toast("Request has been removed " + friendRequest.userTag, 2000, 'red')
    }

    self.changedView = function (x) {
        handleChangeView(x)
    }

    self.handleLogEntrySubmit = function () {
        handleNewActivityEntry()
    }

    self.deleteEntry = function (feedEntry) {
        LOG("deleting entry " + " " + feedEntry.activity + " " + feedEntry.remarks)

        //This should be transactional but... I am not sure
        //that transactions are even possible on firebase
        //give back the points whether positive or negative
        updateUserBalance(feedEntry.points * (-1))
        var refEntry = database.ref(TABLE_LOG_ENTRIES).child(feedEntry.uid).child(feedEntry.id);
        refEntry.remove()
    }

    function createFriendshipId(userId, friendId) {
        if (userId > friendId) {
            return friendId + "_" + userId
        }
        return userId + "_" + friendId
    }

    function requestIsForSelf(friendId) {
        if (friendId === user.uid) {
            return true
        }
        return false
    }

    self.requestFriendship = function (friend) {

        LOG("requestFriendShip called...")

        if (requestIsForSelf(friend.uid)) {
            Materialize.toast("Aww! Love it that you want to be your own friend!", 2000, "green")
            return
        }

        var friendshipKey = createFriendshipId(user.uid, friend.uid)
        var query = database.ref("friends").orderByChild('friendshipKey').equalTo(friendshipKey).limitToFirst(1)

        query.once('value', function (snap) {

            var d = new Date()
            var snapVal = snap.val()

            if (snapVal) {
                Materialize.toast("Request or friendship already exists...", 2000, 'red')
            }
            else {
                var ref2 = database.ref('friends')
                ref2.push({
                        friendshipKey: friendshipKey,
                        requestor: user.uid,
                        acceptor: friend.uid,
                        userTag: user.userTag,
                        email: user.email,
                        accepted: false

                })

                Materialize.toast("Request has been sent....", 2000, 'green')
            }

            setTimeout(function () {
                self.SearchResults([])
                self.SearchEmail("")
            }, 1000)
        })        
    }

    self.showAbout = function(){
        showAboutDialog()
    }
    
    self.showSettings = function () {
        Materialize.toast("User settings coming soon... please stay tuned....", 2000, 'blue')
    }

    self.search = function () {

        LOG("search called....")
        LOG("searching for " +self.SearchEmail())

        const query = database.ref('users')
                        .orderByChild('email')
                        .equalTo(self.SearchEmail())
                        .limitToFirst(1)

        query.on('value', function(snap){
  
            var users = snap.val()

            //users is the full table of users with each nested object by key
            //in order to get the extract the object we must know it's name
            //Since the name is the users id, which is a cryptic value
            //we must extract it dynamically by getting the first property
            //
            //So if you have a return obje of users like this
            //
            //  {
            //       osufoiUOFUsdfsodfjaosuf:{
            //              uid: osufoiUOFUsdfsodfjaosuf,
            //              email: 'somethin@yahoo.com',
            ///             ....
            //       }
            // }
            //
            // you have to extract users.osufoiUOFUsdfsodfjaosuf
            // but there is no way to know that name since it's a key
            // so a way to extract it via reflection by getting the first property out
            // of the root json object
            var firstPropName = getFirstProp(users)
            var resultUser = null

            if (firstPropName) {
                resultUser = users[getFirstProp(users)]
            }

            if (resultUser) {
                resultUser.joined_date = getHowLongAgoItHappenedFromRightNowAsFriendlyString(resultUser.joined)

                LOG("ResultUser:")
                LOG(resultUser)
                self.SearchResults.push(resultUser)
            }
            else {
                Materialize.toast("No results found for email " + self.SearchEmail(), 2000, 'red')
            }
        })
    }
}

model = new MyModel()

//****************************************
//
//  sets the friend requests 
//  The user must already be logged in
//
//****************************************
function setFriendRequests() {

    LOG("Setting friend requests...")
    var ref = database.ref('friends').orderByChild('acceptor').equalTo(user.uid).limitToFirst(20);
    var requests = []

    ref.once('value', function (snap) {
        var tree = snap.val()

        for (var prop in tree) {
            if (tree.hasOwnProperty(prop)) {
                var request = tree[prop]

                if (request.accepted === false) {
                    requests.push(request)
                }
            }
        }

        model.HasRequests(requests.length > 0)
        model.FriendRequests(requests)

        //TODO bad practice... fix later
        if (model.FriendRequests().length > 0) {
            console.log("model.FriendRequests() > 0")
            $('#friends-icon').removeClass('blue-grey-text')
            $('#friends-icon').addClass('deep-orange-text')
        }
        else {
            console.log("model.FriendRequests() < 1")
            $('#friends-icon').removeClass('deep-orange-text')
            $('#friends-icon').addClass('blue-grey-text')
        }
    })
}

function getFriends(query, friends, next) {
    query.once('value', function (snap) {

        var tree = snap.val()

        if (tree) {
            for (var prop in tree) {
                if (tree.hasOwnProperty(prop)) {
                    var friend = tree[prop]

                    if (friend.accepted === true) {
                        if (friend.requestor === user.uid) {
                            friends.push(friend.acceptor)
                        }
                        else {
                            friends.push(friend.requestor)
                        }
                    }
                }
            }
        }

        if (next) {
            next()
        }
    })
}

//good old bubble sort
function sort(friendFeeds, comparator) {

    var swapped

    do {
        swapped = false

        for (var i = 0; i < (friendFeeds.length-1); i++) {
            var temp

            if (comparator(friendFeeds[i], friendFeeds[i + 1])) {
                temp = friendFeeds[i]
                friendFeeds[i] = friendFeeds[i + 1]
                friendFeeds[i + 1] = temp
                swapped = true
            }
        }

    } while (swapped);

    return friendFeeds
}

function getFriendsFeeds(friends, friendsFeeds, onSuccess) {

    //TODO: put a limit here...
    if (friends.length < 1 || friendsFeeds >= MAX_FRIEND_FEED_COUNT) {

        //sort the friends feeds
        friendsFeeds = sort(friendsFeeds,
            function (x, y) {
                 return x.date < y.date
            }
        )

        model.FriendsFeed(friendsFeeds)

        if (onSuccess) {
            onSuccess()
        }

        return
    }

    var friend = friends.shift()

    //TODO: it seems that this is not working correctly
    var logEntriesQuery = database.ref('log_entries').child(friend).orderByChild('date').limitToLast(20)
    //var query = database.ref('log_entries').child(friend).orderByChild('date').limitToFirst(20)

    var friendRef = database.ref('users').child(friend)

    friendRef.once('value', function (friendSnap) {
        if (friendSnap) {
            var friendInfo = friendSnap.val()

            logEntriesQuery.once('value', function (snap) {

                if (snap) {
                    var tree = snap.val()

                    if (tree) {

                        //Each prop in the tree is an entry
                        //assuming that the log entries tree looks like this
                        //  lsadfOIFUERlasdfower: {           //friends user id
                        //
                        //          123143442344:{            //date of entry
                        //
                        //                date:
                        //                activity:
                        //
                        //           },
                        //           92837923492834:
                        //
                        //
                        for (var prop in tree) {
                            if (tree.hasOwnProperty(prop)) {
                                var entry = tree[prop]
                                entry.userTag = friendInfo.userTag
                                entry.profilePicURL = friendInfo.profilePicURL || 'Content/images/default_profile_pic.PNG'
                                entry.dateLogged = getHowLongAgoItHappenedFromRightNowAsFriendlyString(entry.date)

                                friendsFeeds.push(entry)
                            }
                        }
                    }
                }

                getFriendsFeeds(friends, friendsFeeds, onSuccess)
            })

        }
    })
 }

function setFriendsFeed(onSuccess) {
    console.log("Setting friends feeds....")
    var query = database.ref('friends').orderByChild('acceptor').equalTo(user.uid).limitToFirst(20)
    var friends = []
    var friendsFeeds = []
    
    getFriends(query, friends, function () {
        var query2 = database.ref('friends').orderByChild('requestor').equalTo(user.uid).limitToFirst(20)
        getFriends(query2, friends, function () {


            //Get the actual friends for other purposes
            //TODO: later we will need a list of all friends
            for (var i = 0; i < friends.length; i++) {
                let tempFriend = {}

                tempFriend.uid = friends[i]
                model.Friends.push(tempFriend)
            }

            model.FriendsCount(friends.length)

            getFriendsFeeds(friends, friendsFeeds, onSuccess)
        })
    })    
}

function approveOrRejectFriendRequest(accepted, friendRequest) {

    var d = new Date()
    var query = database.ref('friends').orderByChild('friendshipKey').equalTo(friendRequest.friendshipKey).limitToFirst(1)
    
    query.once('value', function (snap) {

        var tree = snap.val()

        if(tree){
            if (accepted) {
               database.ref('friends').child(getFirstProp(tree)).child('accepted').set(true)
            }
            else {
                database.ref('friends').child(getFirstProp(tree)).remove()
            }
        }

        setFriendRequests()
    })
}

function handleChangeView(x) {
    LOG("Setting current view to " + x)
    model.CurrentView(x)
}

function handleSignOut() {

    LOG("Handling signout....")
    LOG(model)
    LOG(user)
    if (model.SignedIn() === true) {

        
        var $toastContent = 'You are now signed out of your session';

        Materialize.toast($toastContent, 4000);

        firebase.auth().signOut().then(function () {
            LOG(USER_SIGNED_OUT_MESSAGE)
        })
    }
}

function bindCreateAccountScreen() {

    $('#create-account-screen').click(function () {
        LOG("cas 1")
        handleSignOut()
        LOG("cas 2")
        handleChangeView("createaccount")
        LOG("cas 3")
        addCreateAccountEvents(handleSignIn)

    })
}

function handleSignIn() {

    model.SignedIn(true)


    //I cannot bind on document ready because these were not rendered intitally
    //so I had to do the binding here instead.
    $('#main').click(function () {
        model.Title("dekarat")
        signoutToMain()
    })

    $('#friends-feed').click(function () {

        setFriendsFeed(function () {
            model.Message("")
            model.Title("friends feed")
            handleChangeView("friendsfeed")
        })
    })

    $('#status').click(function () {
        handleChangeView("status")
        model.Message("")
        model.Title("status")
        bindFileUploadButton()
    })

    $('#news').click(function () {
        handleChangeView("news")
        model.Message("")
        model.Title("news")
    })

    $('#log-item').click(function () {
        switchToLogEntry(true)
    })
        
    model.Title("log entry")

    switchToLogEntry(false)
}

function switchToLogEntry(bindSubmit) {
    handleChangeView("logitem")
    model.Message("")
    model.Title("Log Item")
    $('select').material_select();
    bindLogEntries()
}

function signoutToMain(){
    handleSignOut()
    handleChangeView("main")
    bindCreateAccountScreen()
    //for some reason sign-in and create-account unbind when home is clicked
    $('#sign-in').click(function () {
        //TODO: change later to a better approach to signing in
        validateSignIn(handleSignIn)
    })
}

function showAboutDialog() {

    LOG("Showing about dialog")
    $('#about-dekarat-dialog').show();

    setTimeout(function () {
        $('#about-dekarat-dialog').hide();
    }, 10000)

}

function closeAboutDialog() {
    $('#about-dekarat-dialog').hide();
}

function fileIsValid(file) {

    var isValid = true

    if (file.size > 2300100) {
        isValid = false
    }

    return isValid
}



$(document).ready(function () {

    $('#sign-in').click(function () {
        //TODO: change later to a better approach to signing in
        validateSignIn(handleSignIn)
    })

    $('#sign-out').click(signoutToMain)
    $('#see-our-video').click(seeOurVideo)
    $('#see-our-tutorial').click(seeOurTutorial)
    $('#close-about').click(closeAboutDialog)

    bindCreateAccountScreen()

    model.CurrentView("main")
    ko.applyBindings(model)
});

function seeOurVideo() {
    Materialize.toast("Our video is coming soon... please stay tuned....", 2000, 'blue')
}

function seeOurTutorial() {
    Materialize.toast("Our tutorial video is coming soon... please stay tuned....", 2000, 'blue')
}

function getProfilePicUrl(tempUser, uid) {

    var storageRef = storage.ref().child("photos").child('profile').child(uid + ".jpg");

    tempUser.profilePicURL = "/Content/images/default_profile_pic.png"

    storageRef.getDownloadURL().then(function (url) {

        if (url) {
            tempUser.profilePicURL = url
        }
    })
    .catch(function (e) {
        LOG("Error gettting profile pic URL for a user")
        LOG(e.message)
    })

}

function setProfilePicUrl(next) {

    var storageRef = storage.ref().child("photos").child('profile').child(user.uid + ".jpg");

    user.profilePicURL = "/Content/images/default_profile_pic.png"

    storageRef.getDownloadURL().then(function (url) {

        LOG("Getting profile picture URL")
        if (url) {
            user.profilePicURL = url
            LOG("Profile pic URL set to " + url)
        }

        if (next) {
            next()
            next = null
        }
    })
    .catch(function (e) {
        LOG("Profile Pic not found")
        LOG(e.message)
        LOG("This is normal when the user has not uploaded an image for her profile")
        if (next) {
            next()
        }
    })

}

function bindFileUploadButton() {

    LOG("Binding upload button...")
    var fileButton = document.getElementById('profile-pic-upload-btn')

    fileButton.addEventListener('change', function (e) {

        LOG("Button clicked... or something")
        var file = e.target.files[0];

        if (fileIsValid(file) === true) {

            var storageRef = storage.ref('photos/profile/' + user.uid + '.' + file.name.split('.').pop())

            var task = storageRef.put(file)

            task.on('state_changed',
                function progress(snapshot) {

                },
                function error(err) {
                    Materialize.toast('You picture failed to upload...', 3000, 'red')
                },
                function complete() {
                    Materialize.toast('You picture has uploaded successfully...', 3000, 'green')
                    setProfilePicUrl(function () {
                        model.User().profilePicURL = user.profilePicURL

                        database.ref('users').child(user.uid).child('profilePicURL').set(user.profilePicURL)
                    })
                }
            )
        }
        else {
            Materialize.toast('File must be a jpg 2MB or smaller.', 3000, 'red')
        }
    })
}

//TODO: check for real email
function validateSignIn(onSuccess){

    var txtEmail = document.getElementById('e-mail')
    var txtPassword = document.getElementById('pass-word')
    var auth = firebase.auth()

    auth.onAuthStateChanged(function (firebaseUser) {

        LOG("validateSignin... onAuthStateChanged executing...")
        if (firebaseUser) {
            LOG(USER_SIGNED_IN_MESSAGE)
            model.SignedIn(true)

        }
        else {
            LOG(USER_SIGNED_OUT_MESSAGE)
            model.SignedIn(false)
        }

        LOG("Finished executing validateSigning...onAuthStateChanged")
    })

    var promise = auth.signInWithEmailAndPassword(txtEmail.value, txtPassword.value)
        
    promise.then(function (firebaseUser) {
        if (firebaseUser) {
            var userref = database.ref('users/' + firebaseUser.uid)

            userref.once('value', function (snap) {
                LOG("gettting user data...")
                user = snap.val()
                user.joined_date = getHowLongAgoItHappenedFromRightNowAsFriendlyString(user.joined)
                setProfilePicUrl(function () {

                    model.User(user)
                    LOG("user = snap.val()")
                    LOG(user)
                    LOG(user.email + USER_SIGNED_IN_MESSAGE)
                    model.SignedIn(true)
                    onSuccess()
                    setFriendRequests()
                })                
            })            
        }
        else {
            Materialize.toast("Failed to log in with those credentials", 2000, 'red')
            LOG(USER_SIGNED_OUT_MESSAGE)
            model.SignedIn(false)
        }

    }).catch(function (e) {
        Materialize.toast("Failed to log in... " + e.message, 6000, 'red')
        LOG(e.message)
    })
}

function newTagIsValid(tag, onSuccess, onError) {

    var userTagRef = database.ref('user_tags/' + tag)
    var existingTag = ''

    userTagRef.once('value', function (snap) {
        LOG("key: " + snap.key)
        LOG(snap.val())

        if (snap.val()) {
            onError()
        }
        else {
            onSuccess()
        }
    })
}

//**********************************
//
//  Utilities for validating input
//
//**********************************
function getValue(id) {
    var inputEl = document.getElementById(id)

    return inputEl.value
}

function isEmpty(id) {
    var val = getValue(id)

    var returnVal = val || ""

    LOG("id: " + id + " " + returnVal)

    return !(returnVal)
}

function clearInputValidity(id) {
    setValidity(id, '')
}

function setValidity(id, errorMsg) {
    var inputEl = document.getElementById(id)

    console.log("Element id " + id)
    
    //TODO: we will add better validation later... for now this will do
    Materialize.toast(errorMsg, 3000, 'red')
}

function getHowLongAgoItHappenedFromRightNowAsFriendlyString(pastDate) {

    var d = new Date();
    var currentTime = d.getTime()
    var diff = currentTime - pastDate

    var seconds = Math.floor(diff / 1000)
    var minutes = Math.floor((diff / 1000) / 60)
    var hours = Math.floor(minutes / 60)
    var days = Math.floor(hours / 24)
    var months = Math.floor(days / 30)
    var years = Math.floor(days / 365)

    var returnVal = ''

    if (years > 0) {
        returnVal = years + " years ago"
        if (years == 1) {
            returnVal = years + " year ago"
        }
    }
    else if (months > 0) {
        returnVal = months + " months ago"
        if (months == 1) {
            returnVal = months + " month ago"
        }
    } else if (days > 0) {
        returnVal = days + " days ago"
        if (days == 1) {
            returnVal = days + " day ago"
        }
    }
    else if (hours > 0) {
        returnVal = hours + " hours ago"

        if (hours == 1) {
            returnVal = hours + " hour ago"
        }
    }
    else if (minutes > 0) {
        returnVal = minutes + " minutes ago"
        if (minutes == 1) {
            returnVal = minutes + " minute ago"
        }
    }
    else if (seconds > 0) {
        returnVal = seconds + " seconds ago"
        if (seconds == 1) {
            returnVal = seconds + " second ago"
        }
    }
    else {
        returnVal = "Just now"
    }

    return returnVal
}

//************************END OF UTILITIES ***********************

function validateAccountDataEntry() {

    clearInputValidity('user-tag')
    clearInputValidity('first-name')
    clearInputValidity('last-name')
    clearInputValidity('new-password')
    clearInputValidity('new-email')
    clearInputValidity('v-new-email')

    
    if (isEmpty('user-tag')) {
        return { valid: false, id: 'user-tag', msg: 'User tag is required' }
    }
    else if (isEmpty('first-name')) {
        return { valid: false, id: 'first-name', msg: 'First name is required' }
    }
    else if (isEmpty('last-name')) {
        return { valid: false, id: 'last-name', msg: 'Last name is required' }
    }
    else if (isEmpty('new-email')) {
        return { valid: false, id: 'new-email', msg: 'E-Mail is required' }
    }
    else if (isEmpty('v-new-email')) {
        return { valid: false, id: 'v-new-email', msg: 'Verification E-Mail is required' }
    }
    else if (isEmpty('new-password')) {
        return { valid: false, id: 'new-pasword', msg: 'Password is required' }
    }
    else if (getValue('new-email') != getValue('v-new-email')) {
        return { valid: false, id: 'v-new-email', msg: 'email and verification email must match' }
    }

    return {valid: true}
}

function addCreateAccountEvents(onSuccess) {

    var btnCreateAccount = document.getElementById('create-account')

    btnCreateAccount.addEventListener('click', function (e) {


        var isValid = validateAccountDataEntry();

        if (isValid.valid === false) {
            setValidity(isValid.id, isValid.msg)
            return
        }

        //TODO: validate email and password
        var email = getValue('new-email')
        var password = getValue('new-password')
        var firstname = getValue('first-name')
        var lastname = getValue('last-name')
        var usertag = getValue('user-tag')
        
        var auth = firebase.auth()
        auth.onAuthStateChanged(function (firebaseUser) {
            LOG("onAUthStateChnaged executing...")

            if (firebaseUser) {
                LOG(USER_SIGNED_IN_MESSAGE)
                model.SignedIn(true)
            }
            else {
                LOG(USER_SIGNED_OUT_MESSAGE)
                model.SignedIn(false)
            }

            LOG("onAUthStateChnaged finished...")
        })


        //TODO: this validationg needs to be better structured
        //actually this would be best tested live
        newTagIsValid(
            usertag,
            createUser,
            function () {
                            
                    Materialize.toast('user tag ' + usertag+ ' is already in use', 2000)
            })


        //this is set as a function in order to pass it in if user tag is valid
        function createUser() {
            var promise = auth.createUserWithEmailAndPassword(email, password)
            var d = new Date()

            promise.then(function (firebaseUser) {
                LOG("Then executing....")
                user = {
                    email: firebaseUser.email,
                    firstName: firstname,
                    lastName: lastname,
                    displayName: firstname+ '.' + lastname,
                    uid: firebaseUser.uid,
                    balance: 5000,
                    joined: d.getTime(),
                    userTag: usertag,
                    email_verified: false
                }

                LOG(user)
                LOG(user.email + USER_SIGNED_IN_MESSAGE)

                model.User(user)

                //This code sets the id (key) of user to the firebaseuserid
                //Instead of using push we use set so that we can have control over
                //the key.
                var users = database.ref('users')
                users.child(firebaseUser.uid).set(user)

                database.ref('user_tags/' + user.userTag).child('user_uid').set(user.uid)

                Materialize.toast("Account successfuly created", 2000)
                Materialize.toast("You are now signed in", 2000)
                model.SignedIn(true)
                onSuccess()
            })
            .catch(function (e) {
                Materialize.toast("Failed to create account... " + e.message, 4000)
                LOG(e.message)
            })
        }        
    })
}

function bindLogEntries() {
    database.ref(TABLE_LOG_ENTRIES).child(user.uid).on('value', function (snap) {
        
        LOG("Binding log entries...")
        LOG(snap.val())
        var lastTwentyEntrys = []
        snap.forEach(function (x) {
            if (lastTwentyEntrys.length > 20) {
                lastTwentyEntrys.pop()
            }

            lastTwentyEntrys.unshift(x.val())
            lastTwentyEntrys[0].id = x.key

        })

        model.Feed([])

        //the entries are the users own entries not the friends
        for (var i = 0; i < lastTwentyEntrys.length; i++) {
            model.Feed.push({
                id: lastTwentyEntrys[i].id,
                uid: lastTwentyEntrys[i].uid,
                balance: lastTwentyEntrys[i].balance,
                activity: lastTwentyEntrys[i].activity,
                remarks: lastTwentyEntrys[i].remarks,
                points: lastTwentyEntrys[i].points,
                date: getHowLongAgoItHappenedFromRightNowAsFriendlyString(lastTwentyEntrys[i].date),
                displayName: user.displayName,
                userTag: user.userTag
            });
        }
    })
}

function updateUserBalance(additionalPoints) {
    var userref = database.ref('users/' + user.uid)
    var currentPoints = user['balance'] || 5000
    var newBalance = currentPoints + additionalPoints

    console.log(user['balance'])
    
    userref.child('balance').set(newBalance)

    //My supsicion is that before we were handling the sign it at every sign
    //in but now we only do it when we first load the user
    //there for the balance does not get updated on the user obj
    //and the model
    user.balance = newBalance
    model.User().balance = newBalance

    return newBalance
}

function handleNewActivityEntry() {
    var txtRemarks = document.getElementById('entry-remarks')
    var lb = document.getElementById('entry-options')
    var d = new Date()

    var option = lb.options[lb.selectedIndex].text;
    var optionVal = lb.options[lb.selectedIndex].value

    var entryScore = optionVal > 1000 ? 20 : -20

    var newBalance = updateUserBalance(entryScore)


    //TODO: remove any links from remarks

    //time is in milliseconds since 1970/01/01... perfect for sorting activities

    //
    //Entry will look like this in the database
    //
    // log_entries
    //        -KtvsfI923234... (uid)
    //                    - 1503886666796 (datetime fro Date.getTime as milliseconds from 1/1/1970)
    //                            -uid
    //                            -activity
    //                            -remarks
    //                            -date
    //                            - -20   (-20 or 20 depending on entry)
    var entryId = d.getTime()

    database.ref(TABLE_LOG_ENTRIES).child(user.uid).child(entryId).set({
        uid: user.uid,
        activity: option,
        remarks: txtRemarks.value,
        date: d.getTime(),
        points: entryScore,
        balance: newBalance
    })
    
    txtRemarks.value = ""

    Materialize.toast("Your entry has been logged!", 3000)
}



