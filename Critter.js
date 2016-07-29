/*
critter.js
v0.3 - Post-Compo Edition:
Created by
Matti 'Menithal' Lahtinen on 15/7/16.

This script purpose is to create and maintain a pet entity that follows the client around.
It is only run on the client, and not on the entity. This part is the actual meat of the script.

When an instance of it is created, the preload binds all the script thread updates and starts updating on call.


License:
critter.js Script is Distributed under the CC Creative Commons Attribution
https://creativecommons.org/licenses/by/4.0/
*/

// -------------
// Create a helper.

//Initiate a Object definition
var RAYDISTANCE = 1.2;

if (Critter === undefined) {
    var defaultRules = {
        max_distance: 20,
        keep_within_distance: 20,
        gravity: -9,
        max_turnrate: 5,
        always_flying: true,
        velocity_threshold: 0.5,
        velocity_fast: 4,
        falling_threshold: -0.25,
        flight_velocity: 1,
        flight_distance: 5,
        throttle: (200 / 1000),
        debug: false,
    }
    Critter = function(entity, rules, customTimers) {
        try {
            if (entity === undefined && behavior === undefined) { // Entity, behavior are required. Everything else not.
                throw "Not Enough Arguments!"
            }

            if (rules === undefined || rules.length < 1) {
                rules = defaultRules;
            } else if (arguments.length >= 3) {

                for (var index in defaultRules) {
                    if (rules[index] === undefined) {
                        rules[index] = defaultRules[index];
                    }
                }
            }
            if (rules.debug) {
                for (var index in rules) {
                    print("Critter Setting: " + index + " is " + rules[index])
                }

            }
            this.debugOverlayEnabled = rules.debug;

            this.entityToSpawn = entity;
            var timers = {};
            this.state = 0;
            for (var index in customTimers) {
                timers[customTimers[index]] = 0;
            }
            this.customTimers = timers;
            if (rules.debug) {
                print("Critter Custom Timers: " + JSON.stringify(this.customTimers))
            }
            this.rules = rules;

            this.preload();
        } catch (e) {
            print("Critter: Something went wrong while trying to create my self! " + e.message)
        }
    }

    // 0: idle,  1: moving, 3: moving fast, 4 flying idle, 5 flying forward, 7 flying fast forward

    Critter.prototype = {
        throttle: 0,
        entityToSpawn: null,
        followerID: null,
        rules: null,
        _update: null,
        destination: null,
        destinationOffset: null,
        _cleanup: null,
        debugOverlayEnabled: false,
        debugOverlay: null,
        dimensions: null,
        state: 0,
        states: {
            MOVING: 1,
            MOVING_FAST: 5,
            MOVING_SLOW: 3,
            FALLING: 8,
            JUMPING: 16,
            FLYING: 32
        },
        // Notes. Flying and going up? 24, Flying and going down? 20. etc :)
        controlSafeguard: 0, // Quick timer hack to avoid object from going into a spin loop.
        customTimers: null,

        preupdate: function(properties, timer) {},
        behavior: function(properties, timer) {
            this.warn("Critter: Please define behavior(properties, timer) in prototype")
        },

        isFlying: function() {
            return (this.state & this.states.FLYING) == this.states.FLYING;
        },
        isMoving: function() {
            return (this.state & this.states.MOVING) == this.states.MOVING;
        },
        isMovingFast: function() {
            return (this.state & this.states.MOVING_FAST) == this.states.MOVING_FAST;
        },
        isMovingSlow: function() {
            return (this.state & this.states.MOVING_SLOW) == this.states.MOVING_SLOW;
        },
        isFalling: function() {
            return (this.state & this.states.FALLING) == this.states.FALLING;
        },
        isJumping: function() {
            return (this.state & this.states.JUMPING) == this.states.JUMPING;
        },
        debug: function(message) {
            if (this.debugOverlayEnabled) {
                print(this.entityToSpawn.name + ": " + message)
            }
        },
        warn: function(message) {
            print(this.entityToSpawn.name + ": " + message)
        },
        isDestinationFlying: function() {
            return this.isInAir(this.destination.position, 2);
        },
        isDestinationMoving: function() {
            return Vec3.length(this.destination.velocity) > 0.2;
        },
        newInstance: function(properties){
            this.warn("Critter: Please define newInstance(properties) in prototype")
        },
        preload: function() {

            this.destinationOffset = {
                x: 0,
                y: 0,
                z: 0
            };

            this.controlSafeguard = 0;
            this.throttle = this.rules.throttle;

            for (var index in this.customTimers) {
                this.customTimers[index] = 0;
            }
            this.debug(JSON.stringify(this.customTimers));


            this.newInstance(this.entityToSpawn);

            this.followerID = Entities.addEntity(this.entityToSpawn);

            this.dimensions = this.entityToSpawn.dimensions;

            // Callbacks lose context, especially when called from another thread
            // So Ill have to make a loose reference by creation a function into the object that
            // refers back. It sounds confusing, but this is probably the best way of dealing
            // with this to avoid NPE when using the Script Object callbacks in High Fidelity.
            var _this = this;
            this._cleanup = function() {
                _this.cleanup();
            };
            this._update = function(dt) {
                _this.update(dt);
            };
            Script.update.connect(this._update);
            Script.scriptEnding.connect(this._cleanup);


            if (this.debugOverlayEnabled) {
                this.debugOverlay = Overlays.addOverlay("line3d", {

                    start: {
                        x: 0,
                        y: 0,
                        z: 0
                    },
                    end: {
                        x: 0,
                        y: 1,
                        z: 0
                    },
                    color: {
                        red: 0,
                        green: 255,
                        blue: 255
                    },
                    alpha: 1,
                    lineWidth: 5
                });

            }

            this.debug("Preload Complete");
        },
        targetPosition: function(position) {

            var generatedPosition = Vec3.sum(this.destination.position, position);
            //  generatedPosition.y += 1;

            var ray = {
                origin: generatedPosition,
                direction: {
                    x: 0,
                    y: -1,
                    z: 0
                }
            };
            var trace = Entities.findRayIntersection(ray, true, [], [MyAvatar.sessionUUID, this.followerID]);

            if (trace.intersects && trace.distance < RAYDISTANCE) {
                generatedPosition = trace.intersection;
                generatedPosition.y += 0.125;
            } else {
                generatedPosition.y -= RAYDISTANCE;
            }

            return generatedPosition;
        },

        update: function(dt) {
            this.throttle += dt;
            for (var index in this.customTimers) {
                this.customTimers[index] += dt;
            }
            //If timer is high enough, reset target position
            if (this.throttle > this.rules.throttle) {


                try { // Try catch any possible Exception that may occur

                    // I only need a select few informaiton about this, and avoids me having set -everything-
                    var properties = Entities.getEntityProperties(this.followerID, ["position", "rotation", "angularVelocity", "velocity", "animation"]);
                    this.preupdate(properties, this.throttle);
                    var relativeTargetPosition = this.targetPosition(this.destinationOffset); // get

                    if (properties === undefined || properties === {}) {
                        this.reload();
                        return;
                    }
                    var distance = Vec3.distance(properties.position, relativeTargetPosition);
                    if (properties.position === undefined) {
                        this.throttle = 0;

                        properties.velocity = this.destination.velocity;
                        properties.position = this.destination.position;
                        this.warn("Cannot find");

                        this.reload()

                        return;
                    } else {

                        if (distance > this.rules.max_distance) {
                            this.debug("I am too far! " + distance);
                            if (distance > this.rules.max_distance * 2) {
                                this.warn("I am way too far away to reach you. Resetting from " + distance)
                                this.reload();
                                return;
                            }
                            this.controlSafeguard += this.throttle;
                        }
                    }
                    var speed = 20 * distance / (this.rules.keep_within_distance / 5);

                    var lookAt = Quat.lookAt(properties.position, relativeTargetPosition, {
                        x: 0,
                        y: 1,
                        z: 0
                    });

                    angles = Quat.safeEulerAngles(Quat.multiply(Quat.inverse(properties.rotation), lookAt));

                    if (distance < 0.6) {
                        speed = 0;
                        angles = {
                            x: 0,
                            y: 0,
                            z: 0
                        }
                    }
                    // Clean existing rotations angular velocities, for now.
                    // Get directionality of front
                    angles.z = 0;
                    angles.x = 0;
                    // Now override with vertical attractor

                    var objectUp = Quat.getUp(properties.rotation);
                    var difference = Quat.rotationBetween(objectUp, {
                        x: 0,
                        y: 1,
                        z: 0
                    })

                    var dAngle = 180 * Quat.angle(difference) / Math.PI;
                    if (dAngle > 55) {
                        this.reload();
                    }

                    properties.angularVelocity = Vec3.multiply(angles, 0.12);

                    // Cap turn speed to avoid turning on a dime. Should be tied to instead so that it can turn fast if not moving fast. y rotation is acceptable
                    if (Math.abs(properties.angularVelocity.y) > this.max_turnrate) {
                        properties.angularVelocity.y = properties.angularVelocity.y > 0 ? this.max_turnrate : -this.max_turnrate;
                    }

                    // is total angular velocity still higher than max_turnrate? aka are we spinning out of control? Add to a safeguard
                    if (Vec3.length(properties.angularVelocity) > this.max_turnrate * 2) {
                        this.controlSafeguard += this.throttle;
                    } else {
                        this.controlSafeguard -= this.throttle;
                        if (this.controlSafeguard < 0) {
                            this.controlSafeguard = 0;
                        }
                    }

                    this.state = 0;


                    var front = Quat.normalize(Quat.getFront(properties.rotation));
                    properties.velocity = Vec3.multiply(front, speed * this.throttle);

                    // Vertical Change velocity.
                    if (this.rules.always_flying || this.isDestinationFlying() || this.isInAir(properties.position, this.rules.flight_distance)) {
                        var compensate = (relativeTargetPosition.y - properties.position.y) * this.throttle * 20;
                        properties.velocity = Vec3.multiply(properties.velocity, 2);
                        properties.velocity.y = compensate;
                        this.state = this.state | this.states.FLYING;
                    } else {
                        // Future Ideas: Maybe a for loop to check ever increasing heights upto 5 m high: 0.1, 0.5, 1, 2, 5? for better jump calc?
                        var fromPosition = Vec3.subtract(properties.position, {
                            x: 0,
                            y: this.dimensions.y * .1, // Using this instead of properties dimensions as dimensions can be undefined. Odd behavior, right?
                            z: 0
                        });

                        if (!this.canMoveThere(fromPosition, relativeTargetPosition)) {
                            var diff = (relativeTargetPosition.y - properties.position.y)


                            properties.velocity.y += this.dimensions.y * 2;

                        } else {
                            // This is to make sure unnessary harsh gravity isnt bouncing the TigerPet around
                            if (this.isInAir(properties.position, this.dimensions.y)) {
                                properties.velocity.y = this.rules.gravity * this.throttle;
                                if (this.isInAir(properties.position, this.dimensions.y * 2)) {
                                    this.state = this.state | this.states.FLYING;
                                }
                            } else {
                                properties.velocity.y = (this.rules.gravity / 8) * this.throttle;
                            }
                        }
                    }

                    // Simple Velocity Based Animation State Handler
                    if (properties.velocity.y > this.rules.flight_velocity) {
                        this.state = this.state | this.states.JUMPING;
                    } else if (properties.velocity.y < this.rules.falling_threshold) {
                        this.state = this.state | this.states.FALLING;
                    }

                    var velocity = Vec3.length(properties.velocity);

                    if (velocity > this.rules.velocity_threshold) {
                        this.state = this.state | this.states.MOVING;
                        if (velocity > this.rules.velocity_fast) {
                            this.state = this.state | this.states.MOVING_FAST;
                        }
                    }
                    // This is a quick hack to avoid accidental self-orbiting,. If I had more time or bigger reward, probably would bother doing this properly :)
                    if (this.controlSafeguard > 0.8) {
                        this.warn("Reseting to resume control.")
                        this.controlSafeguard = 0;
                        this.reload();
                        return;
                    }
                    this.behavior(properties, this.throttle);
                    if (this.debugOverlayEnabled) {
                        Overlays.editOverlay(this.debugOverlay, {
                            start: properties.position,
                            end: Vec3.sum(properties.position, Vec3.multiply(properties.velocity, 1)),
                            color: {
                                red: 255,
                                green: 0,
                                blue: 0
                            }
                        });
                    }
                    this.throttle = 0; // Reset the Update callback Throttle

                    // Delete the attributes we aint wanting to set in editEntity,
                    // This avoids us constantly setting currentFrame, and instead let the animation engine handle it.
                    if (properties.animations !== undefined) {
                        delete properties.animation.currentFrame;
                    }
                    delete properties.rotation
                    Entities.editEntity(this.followerID, properties);
                } catch (e) {
                    this.warn("Warning: " + e)
                    this.reload();
                    return;
                }
            }
            //  this.lookAt(properties.position, MyAvatar.position);
        },


        canMoveThere: function(fro, to, distance) {
            distance = distance | 0.5;
            var val = Vec3.normalize(Vec3.subtract(fro, to));
            var rotation = Quat.getFront(Quat.lookAt(fro, to, {
                x: 0,
                y: 1,
                z: 0
            }));

            var ray = {
                origin: fro,
                direction: rotation
            };

            var trace = Entities.findRayIntersection(ray, true, [], [MyAvatar.sessionUUID, this.followerID]);

            return !(trace.intersects && trace.distance < distance)

        },
        isInAir: function(position, distance) {
            var ray = {
                origin: position,
                direction: {
                    x: 0,
                    y: -1,
                    z: 0
                }
            };
            var trace = Entities.findRayIntersection(ray, true, [], [MyAvatar.sessionUUID, this.followerID]);
            if (trace.intersects && trace.distance < distance) {
                return false;
            }
            return true;
        },
        lookAt: function(from, to) {
            Entities.setAbsoluteJointRotationInObjectFrame(this.followerID, NECK_JOINTS[0].index, Quat.lookAt(from, to, {
                x: 0,
                y: 1,
                z: 0
            }));

            return false; // Cannot look at there. Neck doesnt turn that far :(
        },

        reload: function() {
            this.debug("Reloading Follower Script");
            this.cleanup();
            this.preload();
        },
        cleanup: function() {
            Entities.deleteEntity(this.followerID);
            Script.update.disconnect(this._update);
            Script.scriptEnding.disconnect(this._cleanup);

            if (this.debugOverlayEnabled) {
                Overlays.deleteOverlay(this.debugOverlay);
            }
            this.debug("Cleanup Complete");
        }
    }

    print("Critter Ready!")
}
