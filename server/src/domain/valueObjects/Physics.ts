export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export class PhysicsUtils {
  static multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
    return {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    };
  }

  static normalizeQuaternion(q: Quaternion): Quaternion {
    const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
    return {
      x: q.x / length,
      y: q.y / length,
      z: q.z / length,
      w: q.w / length,
    };
  }

  static rotateVectorByQuaternion(v: Vector3, q: Quaternion): Vector3 {
    const qx = q.x,
      qy = q.y,
      qz = q.z,
      qw = q.w;
    const x = v.x,
      y = v.y,
      z = v.z;

    // Calculate quat * vector
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;

    // Calculate result * inverse quat
    return {
      x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
      y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
      z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
    };
  }

  static interpolateQuaternions(
    a: Quaternion,
    b: Quaternion,
    t: number
  ): Quaternion {
    const result = {
      x: a.x * (1 - t) + b.x * t,
      y: a.y * (1 - t) + b.y * t,
      z: a.z * (1 - t) + b.z * t,
      w: a.w * (1 - t) + b.w * t,
    };
    return this.normalizeQuaternion(result);
  }
}
