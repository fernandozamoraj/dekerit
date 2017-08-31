
const USER_SIGNED_OUT_MESSAGE = 'user signed out or failed to sign in...'
const USER_SIGNED_IN_MESSAGE = ' user signed in...'
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

//*****************end of setup firebase
var model;

function MyModel(){
    var self = this;

    self.Feed = ko.observableArray();
    self.User = ko.observable();
    self.CurrentView = ko.observable("main");
    self.SignedIn = ko.observable(false);
    self.Title = ko.observable("dekarat");
    self.Message = ko.observable("");
    self.changedView = function (x) {
        handleChangeView(x)
    };
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
}

model = new MyModel()

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
        handleChangeView("friendsfeed")
        model.Message("")
        model.Title("friends feed")
    })

    $('#status').click(function () {
        handleChangeView("status")
        model.Message("")
        model.Message("status")
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

$(document).ready(function () {

    $('#sign-in').click(function () {
        //TODO: change later to a better approach to signing in
        validateSignIn(handleSignIn)
    })

    $('#sign-out').click(signoutToMain)

    $('#about-dekarat-1').click(showAboutDialog)
    $('#about-dekarat-2').click(showAboutDialog)
    $('#see-our-video').click(seeOurVideo)
    $('#see-our-tutorial').click(seeOurTutorial)
    $('#user-settings').click(showUserSettings)
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

function showUserSettings() {
    Materialize.toast("User settings coming soon... please stay tuned....", 2000, 'blue')
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

            userref.on('value', function (snap) {
                LOG("gettting user data...")
                user = snap.val()
                user.joined_date = getHowLongAgoItHappenedFromRightNowAsFriendlyString( user.joined )
                model.User(user)
                LOG("user = snap.val()")
                LOG(user)
                LOG(user.email + USER_SIGNED_IN_MESSAGE)
                model.SignedIn(true)
                onSuccess()
            })
        }
        else {
            LOG(USER_SIGNED_OUT_MESSAGE)
            model.SignedIn(false)
        }

    }).catch(function (e) {
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
    setValidtiy(id, '')
}

function setValidtiy(id, errorMsg) {
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

    LOG("diff: " + diff)

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

function validateDataEntered() {

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


        var isValid = validateDataEntered();

        if (isValid.valid === false) {
            setValidtiy(isValid.id, isValid.msg)
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

    userref.child('balance').set(newBalance)

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



