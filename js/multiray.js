/**
 * @author rkibria / http://rkibria.netlify.com/
 *
 * https://github.com/rkibria/multiray.js
 *
 * MIT License
 */

var MULTIRAY = {
	Camera: null,
	DielectricMaterial: null,
	Helpers: null,
	HitRecord: null,
	LambertianMaterial: null,
	MetalMaterial: null,
	Ray: null,
	Renderer: null,
	Scene: null,
	Sphere: null,
	Vector3: null,
};

(function (_export) {

/* ************************************
	CLASS: Camera
***************************************

METHODS:

getRay
toString

*/

/// vfov is top to bottom in degrees
function Camera (lookfrom, lookat, vup, vfov, aspect, aperture, focusDist) {
	this.lookfrom = new Vector3();
	this.lookat = new Vector3();
	this.vup = new Vector3();

	this.origin = new Vector3();
	this.lowerLeftCorner = new Vector3();
	this.horizontal = new Vector3();
	this.vertical = new Vector3();

	this.u = new Vector3();
	this.v = new Vector3();
	this.w = new Vector3();

	this.rd = new Vector3();
	this.offset = new Vector3();

	if (lookfrom !== undefined) {
		this.setView(lookfrom, lookat, vup, vfov, aspect, aperture, focusDist);
	}
}

Camera.prototype.setView = function(lookfrom, lookat, vup, vfov, aspect, aperture, focusDist) {
	this.lookfrom.copy(lookfrom);
	this.lookat.copy(lookat);
	this.vup.copy(vup);
	this.vfov = vfov;
	this.aspect = aspect;
	this.aperture = aperture;
	this.focusDist = focusDist;
	this.lensRadius = aperture / 2;

	const theta = vfov * Math.PI / 180.0;
	const halfHeight = Math.tan(theta / 2);
	const halfWidth = aspect * halfHeight;

	this.origin.copy(lookfrom);
	this.w.subVectors(lookfrom, lookat).normalize();
	this.u.crossVectors(vup, this.w).normalize();
	this.v.crossVectors(this.w, this.u);

	this.lowerLeftCorner.copy(this.origin);
	this.lowerLeftCorner.subScaledVector(this.u, halfWidth * focusDist);
	this.lowerLeftCorner.subScaledVector(this.v, halfHeight * focusDist);
	this.lowerLeftCorner.subScaledVector(this.w, focusDist);

	this.horizontal.copyScaled(this.u, 2 * halfWidth * focusDist);
	this.vertical.copyScaled(this.v, 2 * halfHeight * focusDist);
}

Camera.prototype.getRay = function(ray, s, t) {
	this.rd.randomInUnitDisk();
	this.rd.multiplyScalar(this.lensRadius);

	this.offset.copyScaled(this.u, this.rd.x);
	this.offset.addScaledVector(this.v, this.rd.y);

	ray.origin.copy(this.origin);
	ray.origin.add(this.offset);

	ray.direction.copy(this.lowerLeftCorner);
	ray.direction.addScaledVector(this.horizontal, s);
	ray.direction.addScaledVector(this.vertical, t);
	ray.direction.sub(this.origin);
	ray.direction.sub(this.offset);
};

Camera.prototype.toString = function cameraToString() {
	return "Camera(lookfrom:" + String(this.lookfrom)
		+ ", lookat:" + String(this.lookat)
		+ ", vup:" + String(this.vup)
		+ ", vfov:" + String(this.vfov)
		+ ", aspect:" + String(this.aspect)
		+ ", aperture:" + String(this.aperture)
		+ ", focusDist:" + String(this.focusDist)
		+ ")";
};

/* ************************************
	CLASS: DielectricMaterial
***************************************

METHODS:

scatter
toString

*/

function DielectricMaterial (attenuation, refIndex = 1.0) {
	this.attenuation = new Vector3();
	this.attenuation.copy(attenuation);
	this.refIndex = refIndex;
}

DielectricMaterial.prototype.schlick = function(cosine, refIndex) {
	let r0 = (1.0 - refIndex) / (1.0 + refIndex);
	r0 *= r0;
	return r0 + (1.0 - r0) * Math.pow(1.0 - cosine, 5.0);
}

DielectricMaterial.prototype.scatter = function(r_in, rec, attenuation, scattered) {
	const outward_normal = rec._hr_vec3_1;
	const reflected = rec._hr_vec3_2;
	let ni_over_nt = 0.0;
	attenuation.copy(this.attenuation);
	const refracted = rec._hr_vec3_3;
	let reflect_prob = 0.0;
	let cosine = 0.0;

	const uv = rec._hr_vec3_4;
	reflected.reflect(r_in.direction, rec.normal);

	if (r_in.direction.dot(rec.normal) > 0) {
		outward_normal.copyScaled(rec.normal, -1.0);
		ni_over_nt = this.refIndex;
		cosine = this.refIndex * r_in.direction.dot(rec.normal) / r_in.direction.length();
	}
	else {
		outward_normal.copy(rec.normal);
		ni_over_nt = 1.0 / this.refIndex;
		cosine = -1.0 * r_in.direction.dot(rec.normal) / r_in.direction.length();
	}

	uv.copy(r_in.direction);
	uv.normalize();
	if (refracted.refract(uv, outward_normal, ni_over_nt)) {
		reflect_prob = this.schlick(cosine, this.refIndex);
	}
	else {
		reflect_prob = 1.0;
	}

	if (Math.random() < reflect_prob) {
		scattered.origin.copy(rec.p);
		scattered.direction.copy(reflected);
	}
	else {
		scattered.origin.copy(rec.p);
		scattered.direction.copy(refracted);
	}
	return true;
};

DielectricMaterial.prototype.toString = function dielectricMatToString() {
	return "DielectricMaterial(attenuation:" + String(this.attenuation) + ", refIndex:" + String(this.refIndex) + ")";
};

/* ************************************
	CLASS: Helpers
***************************************

METHODS:

getCanvasSize

*/

Helpers = {}

Helpers.getCanvasSize = function(canvas) {
	return {x: canvas.scrollWidth, y: canvas.scrollHeight};
}

/* ************************************
	CLASS: HitRecord
***************************************

METHODS:

toString

*/

function HitRecord () {
	this.t = 0.0;
	this.p = new Vector3();
	this.normal = new Vector3();

	// Temps for use in hit() or scatter() methods
	this._hr_vec3_1 = new Vector3();
	this._hr_vec3_2 = new Vector3();
	this._hr_vec3_3 = new Vector3();
	this._hr_vec3_4 = new Vector3();
}

HitRecord.prototype.toString = function hitrecordToString() {
	return "HitRecord(t:" + String(this.t) + ",p:" + String(this.p) + ",normal:" + String(this.normal) + ")";
};

/* ************************************
	CLASS: LambertianMaterial
***************************************

METHODS:

scatter
toString

*/

function LambertianMaterial (albedo) {
	this.albedo = new Vector3();
	if (albedo !== undefined) {
		this.albedo.copy(albedo);
	}
}

LambertianMaterial.prototype.scatter = function(r_in, rec, attenuation, scattered) {
	attenuation.copy(this.albedo);

	scattered.origin.copy(rec.p);
	scattered.direction.randomInUnitSphere();
	scattered.direction.add(rec.normal);

	return true;
};

LambertianMaterial.prototype.toString = function lambertianMatToString() {
	return "LambertianMaterial(albedo:" + String(this.albedo) + ")";
};

/* ************************************
	CLASS: MetalMaterial
***************************************

METHODS:

scatter
toString

*/

function MetalMaterial (albedo, fuzz = 0.0) {
	this.albedo = new Vector3();
	if (albedo !== undefined) {
		this.albedo.copy(albedo);
	}
	this.fuzz = Math.max(0.0, Math.min(fuzz, 1.0));
}

MetalMaterial.prototype.scatter = function(r_in, rec, attenuation, scattered) {
	attenuation.copy(this.albedo);

	// Use origin as a temp variable
	scattered.origin.randomInUnitSphere();
	scattered.origin.multiplyScalar(this.fuzz);

	scattered.direction.reflect(r_in.direction, rec.normal);
	scattered.direction.add(scattered.origin);

	scattered.origin.copy(rec.p);

	return (scattered.direction.dot(rec.normal) > 0);
};

MetalMaterial.prototype.toString = function lambertianMatToString() {
	return "MetalMaterial(albedo:" + String(this.albedo) + ", fuzz:" + String(this.fuzz) + ")";
};

/* ************************************
	CLASS: Ray
***************************************

METHODS:

at
set
toString

*/

function Ray () {
	this.origin = new Vector3();
	this.direction = new Vector3();
}

Ray.prototype.at = function(t, result) {
	return result.copy(this.direction).multiplyScalar(t).add(this.origin);
}

Ray.prototype.set = function(o, d) {
	this.origin.copy(o);
	this.direction.copy(d);
	return this;
}

Ray.prototype.toString = function rayToString() {
	return "Ray(origin:" + String(this.origin) + ", direction:" + String(this.direction) + ")";
};

/* ************************************
	CLASS: Renderer
***************************************

METHODS:

renderToCanvas
renderToImageData - main render loop
trace

*/

function Renderer () {
	this.maxDepth = 0;
	this.nSamplesPerPixel = 1;

	this._color = new Vector3();
	this._traceStack = [];

	this.sW = 0;
	this.sH = 0;
	this.renderBuffer = [];
	this.nSamplesDone = 0;
}

Renderer.prototype.init = function(sW, sH) {
	this.nSamplesDone = 0;
	this.sW = sW;
	this.sH = sH;
	this.renderBuffer = new Array(sW);
	for (x = 0; x < sW; ++x) {
		this.renderBuffer[x] = new Array(sH);
		for (y = 0; y < sH; ++y) {
			this.renderBuffer[x][y] = new Vector3();
		}
	}
}

Renderer.prototype.render = function(scene, depth) {
	if (depth < 1) {
		throw new Error("[MULTIRAY] depth < 1, not rendering");
	}
	this.maxDepth = depth;

	if (this._traceStack.length < this.maxDepth) {
		this._traceStack = new Array(this.maxDepth);
		for (let i = 0; i < this.maxDepth; ++i) {
			this._traceStack[i] = new TraceStackElement();
		}
	}

	const traceStackFirst = this._traceStack[0];
	for (x = 0; x < this.sW; ++x) {
		for (y = 0; y < this.sH; ++y) {
			const u0 = x / this.sW;
			const v0 = 1.0 - (y / this.sH);
			const u = u0 + Math.random() / this.sW;
			const v = v0 + Math.random() / this.sH;
			scene.camera.getRay(traceStackFirst.ray, u, v);
			this.trace(scene, 0);
			this.renderBuffer[x][y].add(traceStackFirst.color);
		}
	}

	this.nSamplesDone += 1;
}

Renderer.prototype.draw = function(canvas) {
	const ctx = canvas.getContext("2d");
	const imgData = ctx.getImageData(0, 0, this.sW, this.sH);
	const dataLen = imgData.data.length;
	const color = this._color;
	for (let i = 0; i < dataLen; i += 4) {
		const x = (i / 4) % this.sW;
		const y = Math.floor(i / (4 * this.sW));

		// Average color over current number of samples
		color.copy(this.renderBuffer[x][y]);
		color.divideScalar(this.nSamplesDone);

		// Gamma correction
		color.map(Math.sqrt);

		// Write pixel to image data
		const pixel = imgData.data;
		pixel[i] = Math.max (0, Math.min (255, color.x * 255));
		pixel[i+1] = Math.max (0, Math.min (255, color.y * 255));
		pixel[i+2] = Math.max (0, Math.min (255, color.z * 255));
		pixel[i+3] = 255;
	}
	ctx.putImageData(imgData, 0, 0);
}

/*
Perform ray trace using _traceStack[curDepth].ray

Results in _traceStack[curDepth]:
bool hitAnything
nearestHitNormal
nearestHitPoint

*/
Renderer.prototype.trace = function(scene, curDepth) {
	if (curDepth > this.maxDepth) {
		throw new Error("[MULTIRAY] max depth exceeded");
	}

	const traceStackElement = this._traceStack[curDepth];

	const color = traceStackElement.color;
	color.setScalar(0.0);
	const nearestHitNormal = traceStackElement.nearestHitNormal;
	const nearestHitPoint = traceStackElement.nearestHitPoint;
	const hitRec = traceStackElement.hitRec;
	const ray = traceStackElement.ray;
	const attenuation = traceStackElement.attenuation;

	// Loop through all objects to find if we hit one, and if yes the closest (lowest t value) of them
	traceStackElement.hitAnything = false;
	let lowestT = Infinity;
	let hitObject = null;
	const nSceneObjects = scene.objects.length;
	for (let i = 0; i < nSceneObjects; ++i) {
		const curObject = scene.objects[i];
		const isHit = curObject.hit(ray, 0.001, Infinity, hitRec);
		if (isHit) {
			traceStackElement.hitAnything = true;
			if (hitRec.t < lowestT) {
				lowestT = hitRec.t;
				nearestHitPoint.copy(hitRec.p);
				nearestHitNormal.copy(hitRec.normal);
				hitObject = curObject;
			}
		}
	}

	// If object hit then compute the color (possibly requiring more traces), else use background color
	if (traceStackElement.hitAnything) {
		// color.mapFrom(nearestHitNormal, function(x) {return 0.5*(x+1.0);}); // debugging: color from hit normal

		// Store closest hit in current HitRecord
		hitRec.t = lowestT;
		hitRec.p.copy(nearestHitPoint);
		hitRec.normal.copy(nearestHitNormal);

		// If we are not at max depth shoot a reflected ray
		reflectionHit = false;
		if (curDepth < this.maxDepth - 1) {
			nextDepth = curDepth + 1;

			const nextStackElement = this._traceStack[nextDepth];
			const nextRay = nextStackElement.ray;

			if (hitObject.material.scatter(ray, hitRec, attenuation, nextRay)) {
				this.trace(scene, nextDepth);

				color.copy(nextStackElement.color);
				color.multiply(attenuation);
			}
		}
	}
	else {
		traceStackElement._tse_vec3_1.copy(ray.direction);
		traceStackElement._tse_vec3_1.normalize();
		t = 0.5 * (traceStackElement._tse_vec3_1.y + 1.0);
		color.set(0.5, 0.7, 1.0);
		color.multiplyScalar(t);
		color.addScalar(1.0 - t);
	}
}

/* ************************************
	CLASS: Scene
***************************************

METHODS:

addObject
setCamera
toString

*/

function Scene () {
	this.camera = null;
	this.objects = [];
}

Scene.prototype.addObject = function(obj) {
	this.objects.push(obj);
};

Scene.prototype.setCamera = function(cam) {
	this.camera = cam;
};

Scene.prototype.toString = function sceneToString() {
	let out = "Scene(<br>" + String(this.camera) + "<br>" + this.objects.length + " objects:<br>";
	for (let i = 0; i < this.objects.length; ++i) {
		out += String(this.objects[i]) + "<br>";
	}
	out += ")";
	return out;
};

/* ************************************
	CLASS: Sphere
***************************************

METHODS:

hit
toString

*/

function Sphere (id, center, radius = 0.0, material = null) {
	this.id = id;
	this.center = new Vector3();
	if (center !== undefined) {
		this.center.copy(center);
	}
	this.radius = radius;
	this.material = material;
}

Sphere.prototype.hit = function(ray, tMin, tMax, hitRec) {
	const oc = hitRec._hr_vec3_1;
	oc.subVectors(ray.origin, this.center);

 	const a = ray.direction.dot(ray.direction);
	const b = oc.dot(ray.direction);
	const c = oc.dot(oc) - this.radius * this.radius;
 	const discriminant = b*b - a*c;

	if (discriminant > 0) {
		const temp1 = (-b - Math.sqrt(discriminant))/a;
		if (temp1 < tMax && temp1 > tMin) {
			hitRec.t = temp1;
			ray.at(temp1, hitRec.p);

			hitRec.normal.subVectors(hitRec.p, this.center);
			hitRec.normal.divideScalar(this.radius);

			return true;
		}
		const temp2 = (-b + Math.sqrt(discriminant)) / a;
		if (temp2 < tMax && temp2 > tMin) {
			hitRec.t = temp2;
			ray.at(temp2, hitRec.p);

			hitRec.normal.subVectors(hitRec.p, this.center);
			hitRec.normal.divideScalar(this.radius);

			return true;
		}
	}
	return false;
};

Sphere.prototype.toString = function rayToString() {
	return this.id + "(center:" + String(this.center) + ", radius:" + this.radius + ", " + String(this.material) + ")";
};

/* ************************************
	CLASS: TraceStackElement
***************************************

METHODS:

toString

*/

function TraceStackElement () {
	this.color = new Vector3();
	this.hitAnything = false;
	this.hitRec = new HitRecord();
	this.nearestHitNormal = new Vector3();
	this.nearestHitPoint = new Vector3();
	this.ray = new Ray();
	this.attenuation = new Vector3();

	// Temps for use during trace
	this._tse_vec3_1 = new Vector3();
}

TraceStackElement.prototype.toString = function traceStackElementToString() {
	return "TraceStackElement(" + String(this.ray) + ",color:" + String(this.color) + ")";
};

/* ************************************
	CLASS: Vector3
***************************************

METHODS:

add
addScalar
addScaledVector
addVectors
copy
copyScaled
crossVectors
divide
divideScalar
dot
equals
length
lengthSq
map
mapFrom
multiply
multiplyScalar
multiplyVectors
normalize
randomInUnitSphere
reflect
refract
set
setScalar
sub
subScalar
subVectors
subScaledVector
toString

*/

function Vector3 (x = 0.0, y = 0.0, z = 0.0) {
	this.x = x;
	this.y = y;
	this.z = z;
}

Vector3.prototype.add = function(v) {
	this.x += v.x;
	this.y += v.y;
	this.z += v.z;
	return this;
};

Vector3.prototype.addScalar = function(s) {
	this.x += s;
	this.y += s;
	this.z += s;
	return this;
};

Vector3.prototype.addScaledVector = function(v, s) {
	this.x += v.x * s;
	this.y += v.y * s;
	this.z += v.z * s;
	return this;
};

Vector3.prototype.addVectors = function(a, b) {
	this.x = a.x + b.x;
	this.y = a.y + b.y;
	this.z = a.z + b.z;
	return this;
};

Vector3.prototype.copy = function(v) {
	this.x = v.x;
	this.y = v.y;
	this.z = v.z;
	return this;
};

Vector3.prototype.copyScaled = function(v, s) {
	this.x = v.x * s;
	this.y = v.y * s;
	this.z = v.z * s;
	return this;
};

Vector3.prototype.crossVectors = function(a, b) {
	const ax = a.x, ay = a.y, az = a.z;
	const bx = b.x, by = b.y, bz = b.z;

	this.x = ay * bz - az * by;
	this.y = az * bx - ax * bz;
	this.z = ax * by - ay * bx;

	return this;
};

Vector3.prototype.divide = function(v) {
	this.x /= v.x;
	this.y /= v.y;
	this.z /= v.z;
	return this;
};

Vector3.prototype.divideScalar = function(s) {
	this.x /= s;
	this.y /= s;
	this.z /= s;
	return this;
};

Vector3.prototype.dot = function(v) {
	return this.x * v.x + this.y * v.y + this.z * v.z;
};

Vector3.prototype.equals = function(v) {
	return this.x == v.x && this.y == v.y && this.z == v.z;
};

Vector3.prototype.length = function() {
	return Math.sqrt (this.x * this.x + this.y * this.y + this.z * this.z);
};

Vector3.prototype.lengthSq = function() {
	return (this.x * this.x + this.y * this.y + this.z * this.z);
};

Vector3.prototype.map = function(f) {
	this.x = f(this.x);
	this.y = f(this.y);
	this.z = f(this.z);
	return this;
};

Vector3.prototype.mapFrom = function(v, f) {
	this.x = f(v.x);
	this.y = f(v.y);
	this.z = f(v.z);
	return this;
};

Vector3.prototype.multiply = function(v) {
	this.x *= v.x;
	this.y *= v.y;
	this.z *= v.z;
	return this;
};

Vector3.prototype.multiplyScalar = function(s) {
	this.x *= s;
	this.y *= s;
	this.z *= s;
	return this;
};

Vector3.prototype.multiplyVectors = function(a, b) {
	this.x = a.x * b.x;
	this.y = a.y * b.y;
	this.z = a.z * b.z;
	return this;
};

Vector3.prototype.normalize = function() {
	return this.divideScalar (this.length());
};

Vector3.prototype.randomInUnitDisk = function() {
	do {
		this.x = 2.0 * Math.random() - 1.0;
		this.y = 2.0 * Math.random() - 1.0;
		this.z = 0;
	} while (this.lengthSq() >= 1.0);
	return this;
};

Vector3.prototype.randomInUnitSphere = function() {
	do {
		this.x = 2.0 * Math.random() - 1.0;
		this.y = 2.0 * Math.random() - 1.0;
		this.z = 2.0 * Math.random() - 1.0;
	} while (this.lengthSq() >= 1.0);
	return this;
};

Vector3.prototype.reflect = function(v, n) {
	this.copy(n);
	this.multiplyScalar(-2 * v.dot(n));
	this.add(v);
	return this;
};

/// uv is normalized
Vector3.prototype.refract = function(uv, n, ni_over_nt) {
	const dt = uv.dot(n);
	const discriminant = 1.0 - ni_over_nt * ni_over_nt * (1.0 - dt * dt);
	if (discriminant > 0) {
		this.copy(uv);
		this.subScaledVector(n, dt);
		this.multiplyScalar(ni_over_nt);
		this.subScaledVector(n, Math.sqrt(discriminant));
		return true;
	}
	else {
		return false;
	}
};

Vector3.prototype.set = function(x, y, z) {
	this.x = x;
	this.y = y;
	this.z = z;
	return this;
};

Vector3.prototype.setScalar = function(s) {
	this.x = s;
	this.y = s;
	this.z = s;
	return this;
};

Vector3.prototype.sub = function(v) {
	this.x -= v.x;
	this.y -= v.y;
	this.z -= v.z;
	return this;
};

Vector3.prototype.subScalar = function(s) {
	this.x -= s;
	this.y -= s;
	this.z -= s;
	return this;
};

Vector3.prototype.subScaledVector = function(v, s) {
	this.x -= v.x * s;
	this.y -= v.y * s;
	this.z -= v.z * s;
	return this;
};

Vector3.prototype.subVectors = function(a, b) {
	this.x = a.x - b.x;
	this.y = a.y - b.y;
	this.z = a.z - b.z;
	return this;
};

Vector3.prototype.toString = function vector3ToString() {
	return "[" + this.x + ', ' + this.y + ', ' + this.z + "]";
};

/* ************************************
	Exports
**************************************/

_export.Camera = Camera;
_export.DielectricMaterial = DielectricMaterial;
_export.Helpers = Helpers;
_export.HitRecord = HitRecord;
_export.LambertianMaterial = LambertianMaterial;
_export.MetalMaterial = MetalMaterial;
_export.Ray = Ray;
_export.Renderer = Renderer;
_export.Scene = Scene;
_export.Sphere = Sphere;
_export.Vector3 = Vector3;

}(MULTIRAY));

/* ************************************
	TEST: Ray
**************************************/

(function MULTIRAY_TEST_Ray() {
	const Ray = MULTIRAY.Ray;
	const Vector3 = MULTIRAY.Vector3;

	console.log("[MULTIRAY_TEST] Running Ray tests...");

	const r1 = new Ray();
	console.log("[MULTIRAY_TEST]", String(r1));

	r1.origin.set(10, 20, 30);
	r1.direction.set(1, 2, 3);
	const rv1 = new Vector3();
	r1.at(2.0, rv1);
	console.assert(rv1.x == 12 && rv1.y == 24 && rv1.z == 36);
}());

/* ************************************
	TEST: Scene
**************************************/

(function MULTIRAY_TEST_Scene() {
	const Scene = MULTIRAY.Scene;
	const Sphere = MULTIRAY.Sphere;
	const Vector3 = MULTIRAY.Vector3;

	console.log("[MULTIRAY_TEST] Running Scene tests...");

	const scene = new Scene();

	const s1 = new Sphere();
	s1.center.set(0, 0, -2);
	s1.radius = 1;

	scene.addObject(s1);
	console.log("[MULTIRAY_TEST]", String(scene));
}());

/* ************************************
	TEST: Sphere
**************************************/

(function MULTIRAY_TEST_Sphere() {
	const Ray = MULTIRAY.Ray;
	const Sphere = MULTIRAY.Sphere;
	const Vector3 = MULTIRAY.Vector3;
	const HitRecord = MULTIRAY.HitRecord;

	console.log("[MULTIRAY_TEST] Running Sphere tests...");

	const s1 = new Sphere("sph1");
	console.log("[MULTIRAY_TEST]", String(s1));

	const rv1 = new Vector3(1, 2, 3);
	const s2 = new Sphere("sph1", rv1, 4);
	console.assert(s2.center.x == 1 && s2.center.y == 2 && s2.center.z == 3 && s2.radius == 4);

	const r1 = new Ray();
	r1.origin.set(0, 0, 0);
	r1.direction.set(0, 0, -1);

	const hr1 = new HitRecord();

	s1.center.set(0, 0, -2);
	s1.radius = 1;
	let hitResult = s1.hit(r1, 0.01, Infinity, hr1);
	console.log("[MULTIRAY_TEST]", String(hr1), ":", hitResult);
	console.assert(hitResult == true
		&& hr1.t == 1
		&& hr1.p.x == 0 && hr1.p.y == 0 && hr1.p.z == -1
		&& hr1.normal.x == 0 && hr1.normal.y == 0 && hr1.normal.z == 1
	);

	s1.center.set(0, 0, 2);
	s1.radius = 1;
	hitResult = s1.hit(r1, 0.01, Infinity, hr1);
	console.assert(hitResult == false);
}());

/* ************************************
	TEST: Vector3
**************************************/

(function MULTIRAY_TEST_Vector3() {
	const Vector3 = MULTIRAY.Vector3;

	console.log("[MULTIRAY_TEST] Running Vector3 tests...");

	const rv1 = new Vector3();
	console.log("[MULTIRAY_TEST]", String(rv1));
	console.assert(rv1.x == 0 && rv1.y == 0 && rv1.z == 0);

	const rv2 = new Vector3(1, 2, 3);
	console.assert(rv2.x == 1 && rv2.y == 2 && rv2.z == 3);

	const rv3 = new Vector3(4, 5, 6);
	console.assert(rv3.x == 4 && rv3.y == 5 && rv3.z == 6);

	rv3.add(rv2);
	console.assert(rv3.x == 5 && rv3.y == 7 && rv3.z == 9);

	// (5,7,9)+(1,2,3)=(6,9,12)
	// (6,9,12)+(6,9,12)=(12,18,24)
	rv3.add(rv3.add(rv2));
	console.assert(rv3.x == 12 && rv3.y == 18 && rv3.z == 24);

	rv3.copy(rv2);
	console.assert(rv3.x == 1 && rv3.y == 2 && rv3.z == 3);

	rv2.addScalar(3);
	console.assert(rv2.x == 4 && rv2.y == 5 && rv2.z == 6);

	rv2.setScalar(0);
	console.assert(rv2.x == 0 && rv2.y == 0 && rv2.z == 0);

	rv2.set(1, 2, 3);
	console.assert(rv2.x == 1 && rv2.y == 2 && rv2.z == 3);

	// (1,2,3)+3*(1,2,3)=(1,2,3)+(3,6,9)=(4,8,12)
	rv2.addScaledVector(rv3, 3);
	console.assert(rv2.x == 4 && rv2.y == 8 && rv2.z == 12);

	rv1.set(99, 99, 99);
	rv2.set(1, 2, 3);
	rv3.set(7, 8, 9);
	rv1.addVectors(rv2, rv3);
	console.assert(rv1.x == 8 && rv1.y == 10 && rv1.z == 12);

	rv1.sub(rv3);
	console.assert(rv1.x == 1 && rv1.y == 2 && rv1.z == 3);

	rv1.subScalar(1);
	console.assert(rv1.x == 0 && rv1.y == 1 && rv1.z == 2);

	rv1.set(99, 99, 99);
	rv2.set(1, 2, 3);
	rv3.set(7, 8, 9);
	rv1.subVectors(rv2, rv3);
	console.assert(rv1.x == -6 && rv1.y == -6 && rv1.z == -6);

	rv1.set(1, 2, 3);
	rv2.set(1, 2, 3);
	console.assert(rv1.equals(rv2));
	rv2.set(5, 7, 3);
	console.assert(!rv1.equals(rv2));

	rv2.set(4, 9, 10);
	rv3.set(2, 3, 5);
	rv2.divide(rv3);
	console.assert(rv2.x == 2 && rv2.y == 3 && rv2.z == 2);

	rv2.set(4, 8, 10);
	rv2.divideScalar(2);
	console.assert(rv2.x == 2 && rv2.y == 4 && rv2.z == 5);

	rv2.set(4, 9, 10);
	rv3.set(2, 3, 5);
	rv2.multiply(rv3);
	console.assert(rv2.x == 8 && rv2.y == 27 && rv2.z == 50);

	rv2.set(4, 8, 10);
	rv2.multiplyScalar(2);
	console.assert(rv2.x == 8 && rv2.y == 16 && rv2.z == 20);

	rv1.set(99, 99, 99);
	rv2.set(1, 2, 3);
	rv3.set(7, 8, 9);
	rv1.multiplyVectors(rv2, rv3);
	console.assert(rv1.x == 7 && rv1.y == 16 && rv1.z == 27);

	rv1.set(2, 0, 0);
	console.assert(rv1.length() == 2);
	rv1.normalize();
	console.assert(rv1.length() == 1);
	console.assert(rv1.x == 1 && rv1.y == 0 && rv1.z == 0);

	rv1.set(1, 0, 0);
	rv2.set(0, 1, 0);
	rv3.crossVectors(rv1, rv2);
	console.assert(rv3.length() == 1);
	console.assert(rv3.x == 0 && rv3.y == 0 && rv3.z == 1);

	rv1.set(-1, -2, -5);
	rv1.map(Math.abs);
	console.assert(rv1.x == 1 && rv1.y == 2 && rv1.z == 5);
	rv2.set(-8, -4, -3);
	rv1.mapFrom(rv2, Math.abs);
	console.assert(rv1.x == 8 && rv1.y == 4 && rv1.z == 3);

	rv1.randomInUnitSphere();
	console.assert(rv1.lengthSq() <= 1.0);

}());
