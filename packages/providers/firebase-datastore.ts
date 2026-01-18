/**
 * Firebase DataStore Adapter
 * Implements DataStore interface using Firestore
 * Phase 0: Fast shipping with Firestore, but behind abstraction
 */

import * as admin from 'firebase-admin';
import type { 
  DataStore, 
  QueryFilter, 
  BatchOperation, 
  Transaction 
} from './interfaces';

export class FirebaseDataStore implements DataStore {
  private db: admin.firestore.Firestore;

  constructor() {
    // Assumes admin is already initialized by identity provider
    this.db = admin.firestore();
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    try {
      const doc = await this.db.collection(collection).doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return {
        id: doc.id,
        ...doc.data(),
      } as T;
    } catch (error) {
      throw new Error(`Failed to get document: ${error}`);
    }
  }

  async query<T>(collection: string, filters: QueryFilter[]): Promise<T[]> {
    try {
      let query: admin.firestore.Query = this.db.collection(collection);
      
      for (const filter of filters) {
        query = query.where(
          filter.field,
          filter.operator as admin.firestore.WhereFilterOp,
          filter.value
        );
      }
      
      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
    } catch (error) {
      throw new Error(`Failed to query documents: ${error}`);
    }
  }

  async create<T>(collection: string, id: string, data: T): Promise<T> {
    try {
      const docRef = this.db.collection(collection).doc(id);
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      
      const docData = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      
      await docRef.set(docData);
      
      return {
        id,
        ...docData,
      } as T;
    } catch (error) {
      throw new Error(`Failed to create document: ${error}`);
    }
  }

  async update<T>(collection: string, id: string, data: Partial<T>): Promise<T> {
    try {
      const docRef = this.db.collection(collection).doc(id);
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      
      const updateData = {
        ...data,
        updatedAt: timestamp,
      };
      
      await docRef.update(updateData as admin.firestore.UpdateData<admin.firestore.DocumentData>);
      
      const updated = await this.get<T>(collection, id);
      if (!updated) {
        throw new Error('Document not found after update');
      }
      
      return updated;
    } catch (error) {
      throw new Error(`Failed to update document: ${error}`);
    }
  }

  async delete(collection: string, id: string): Promise<void> {
    try {
      await this.db.collection(collection).doc(id).delete();
    } catch (error) {
      throw new Error(`Failed to delete document: ${error}`);
    }
  }

  async batch(operations: BatchOperation[]): Promise<void> {
    try {
      const batch = this.db.batch();
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      
      for (const op of operations) {
        const ref = this.db.collection(op.collection).doc(op.id);
        
        switch (op.type) {
          case 'create':
            batch.set(ref, {
              ...(op.data as object),
              createdAt: timestamp,
              updatedAt: timestamp,
            });
            break;
          case 'update':
            batch.update(ref, {
              ...(op.data as object),
              updatedAt: timestamp,
            } as admin.firestore.UpdateData<admin.firestore.DocumentData>);
            break;
          case 'delete':
            batch.delete(ref);
            break;
        }
      }
      
      await batch.commit();
    } catch (error) {
      throw new Error(`Failed to execute batch: ${error}`);
    }
  }

  async runTransaction<T>(
    callback: (transaction: Transaction) => Promise<T>
  ): Promise<T> {
    return await this.db.runTransaction(async (firestoreTransaction) => {
      const transactionAdapter: Transaction = {
        get: async <T>(collection: string, id: string): Promise<T | null> => {
          const ref = this.db.collection(collection).doc(id);
          const doc = await firestoreTransaction.get(ref);
          
          if (!doc.exists) {
            return null;
          }
          
          return {
            id: doc.id,
            ...doc.data(),
          } as T;
        },
        
        create: <T>(collection: string, id: string, data: T): void => {
          const ref = this.db.collection(collection).doc(id);
          const timestamp = admin.firestore.FieldValue.serverTimestamp();
          
          firestoreTransaction.set(ref, {
            ...data,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        },
        
        update: <T>(collection: string, id: string, data: Partial<T>): void => {
          const ref = this.db.collection(collection).doc(id);
          const timestamp = admin.firestore.FieldValue.serverTimestamp();
          
          firestoreTransaction.update(ref, {
            ...(data as object),
            updatedAt: timestamp,
          } as admin.firestore.UpdateData<admin.firestore.DocumentData>);
        },
        
        delete: (collection: string, id: string): void => {
          const ref = this.db.collection(collection).doc(id);
          firestoreTransaction.delete(ref);
        },
      };
      
      return await callback(transactionAdapter);
    });
  }
}

// Singleton instance
let dataStore: FirebaseDataStore | null = null;

export function getDataStore(): DataStore {
  if (!dataStore) {
    dataStore = new FirebaseDataStore();
  }
  return dataStore;
}
