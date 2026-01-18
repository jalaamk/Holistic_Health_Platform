import {
  IDatabase,
  ICollection,
  IDocument,
  IQuery,
  WhereOperator,
} from "@/interfaces/database.interface";
import { getFirebaseAdmin } from "./firebase-admin";
import type { Firestore, Query, WhereFilterOp } from "firebase-admin/firestore";

export class FirestoreDatabase implements IDatabase {
  private db: Firestore | null = null;

  private getDb(): Firestore {
    if (!this.db) {
      const { firestore } = getFirebaseAdmin();
      this.db = firestore;
    }
    return this.db;
  }

  collection<T>(name: string): ICollection<T> {
    return new FirestoreCollection<T>(this.getDb().collection(name));
  }
}

class FirestoreCollection<T> implements ICollection<T> {
  constructor(private collectionRef: FirebaseFirestore.CollectionReference) {}

  doc(id: string): IDocument<T> {
    return new FirestoreDocument<T>(this.collectionRef.doc(id));
  }

  query(): IQuery<T> {
    return new FirestoreQuery<T>(this.collectionRef);
  }

  async add(data: Omit<T, "id">): Promise<string> {
    const docRef = await this.collectionRef.add(data as Record<string, unknown>);
    return docRef.id;
  }
}

class FirestoreDocument<T> implements IDocument<T> {
  constructor(private docRef: FirebaseFirestore.DocumentReference) {}

  async get(): Promise<T | null> {
    const snapshot = await this.docRef.get();
    if (!snapshot.exists) {
      return null;
    }
    return { id: snapshot.id, ...snapshot.data() } as T;
  }

  async set(data: T): Promise<void> {
    await this.docRef.set(data as Record<string, unknown>);
  }

  async update(data: Partial<T>): Promise<void> {
    await this.docRef.update(data as Record<string, unknown>);
  }

  async delete(): Promise<void> {
    await this.docRef.delete();
  }
}

class FirestoreQuery<T> implements IQuery<T> {
  constructor(
    private queryRef: FirebaseFirestore.CollectionReference | Query
  ) {}

  where(field: string, op: WhereOperator, value: unknown): IQuery<T> {
    const firestoreOp = op as WhereFilterOp;
    return new FirestoreQuery<T>(this.queryRef.where(field, firestoreOp, value));
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc"): IQuery<T> {
    return new FirestoreQuery<T>(this.queryRef.orderBy(field, direction));
  }

  limit(count: number): IQuery<T> {
    return new FirestoreQuery<T>(this.queryRef.limit(count));
  }

  async get(): Promise<T[]> {
    const snapshot = await this.queryRef.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
  }
}

let databaseInstance: FirestoreDatabase | null = null;

export function getDatabase(): IDatabase {
  if (!databaseInstance) {
    databaseInstance = new FirestoreDatabase();
  }
  return databaseInstance;
}

export const database = getDatabase();
