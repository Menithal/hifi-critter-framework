// Basic Following critter


// The following object works is the exactly the same object you define for an Entity for addEntity call,
//  however this is just used to define the entity we want to create and mode.
var ExampleEntityProperties = {
    name: "ExamplePet",
    type: "Box",
    collisionless: false,
    dimensions: {
        x: 0.5,
        y: 0.5,
        z: 0.5
    },
    gravity: {
        x: 0,
        y: 0,
        z: 0
    },
    grabbable: false,
    animation: {
        currentFrame: 0
    },
    collidesWith: "static,dynamic,kinematic",
    lifetime: 3600,
    dynamic: true
};
// Bind Critter variable as ain included external script.
var Critter;
Script.include(Script.resolvePath("Critter.js"));

// Overrides
// This occurs when the instance of the Critter is created again
Critter.prototype.newInstance = function(properties) {

    properties.position = MyAvatar.position;
    properties.rotation = MyAvatar.orientation;
};
// The following occurs before velocities are destinations are calculated
Critter.prototype.preupdate = function(properties, timer) {
    this.destination = MyAvatar;
    // Destination is MyAvatar. You can also use entity properties, as long
    // this.destination has a position and rotation variable
};
// The following overrides the critter's behavior
Critter.prototype.behavior = function(properties, timer) {
    /*
     note, what ever variable you set in properties, it will update the reference made in the update thread.
     DO NOT however replace the entire properties instance. as this will cause the back references to stop working

     You can however set animations here, such as properties.animation = {
         url: "url",
         loop: true,
         startFrame: 1,
         endFrame: 90,
         fps: 30,
         running: true
     }
     By default, behavior will -ALWAYS- have forward velocity, and a angularVelocity based on distance to the the avatar position + destination offset, however anything you do with them here overrides it.

    */

    this.destinationOffset = {
        x: 0,
        y: 3,
        z: 0
    }; // Reference variable only available for this critter instance.
};

var rules = {
    max_distance: 10,
    gravity: ExampleEntityProperties.gravity.y,
    always_flying: true
}

new Critter(ExampleEntityProperties, rules, ["custom"]);
