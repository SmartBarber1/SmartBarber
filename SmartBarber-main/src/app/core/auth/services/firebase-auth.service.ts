import { Injectable } from '@angular/core';

import {
    Auth,
    GoogleAuthProvider,
    User,
    browserPopupRedirectResolver,
    getAuth,
    inMemoryPersistence,
    initializeAuth,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from 'firebase/auth';

import {
    getApps,
    initializeApp
} from 'firebase/app';

import {
    BehaviorSubject,
    Observable
} from 'rxjs';

import {
    firebaseConfig
} from '../../../../environments/firebase.config';

@Injectable({
    providedIn: 'root'
})
export class FirebaseAuthService {

    private readonly firebaseApp =
        initializeApp(firebaseConfig);

    private readonly auth: Auth =
        getAuth(this.firebaseApp);

    private employeeRegistrationAuth: Auth | null = null;

    private readonly userSubject =
        new BehaviorSubject<User | null>(
            this.auth.currentUser
        );

    readonly user$: Observable<User | null> =
        this.userSubject.asObservable();


    constructor() {

        onAuthStateChanged(
            this.auth,
            (user) => {

                this.userSubject.next(user);
            }
        );
    }


    async waitForAuthState(): Promise<User | null> {

        await this.auth.authStateReady();

        const user =
            this.auth.currentUser;

        this.userSubject.next(user);

        return user;
    }


   async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();

    provider.setCustomParameters({
        prompt: 'select_account'
    });

    try {
        const result = await signInWithPopup(
            this.auth,
            provider
        );

        this.userSubject.next(result.user);

        return result.user;
    } catch (error: unknown) {
        console.error(
            'Error al iniciar sesión con Google:',
            error
        );

        throw error;
    }
}

    async signInWithGoogleForEmployeeRegistration(): Promise<User> {
        const provider = new GoogleAuthProvider();

        provider.setCustomParameters({
            prompt: 'select_account'
        });

        const result = await signInWithPopup(
            this.getEmployeeRegistrationAuth(),
            provider
        );

        return result.user;
    }

    async signOutEmployeeRegistration(): Promise<void> {
        await signOut(
            this.getEmployeeRegistrationAuth()
        );
    }


    async getIdToken(): Promise<string | null> {

        const user =
            this.auth.currentUser;

        if (!user) {
            return null;
        }

        return user.getIdToken();
    }


    getCurrentUser(): User | null {

        return this.auth.currentUser;
    }


    async logout(): Promise<void> {

        await signOut(this.auth);

        this.userSubject.next(null);
    }

    private getEmployeeRegistrationAuth(): Auth {
        if (!this.employeeRegistrationAuth) {
            const appName =
                'smartbarber-employee-registration';
            const existingApp =
                getApps().find(app => app.name === appName);

            // La cuenta del barbero solo se usa para obtener su token durante
            // el registro: se guarda en memoria y no queda persistida en el
            // navegador del administrador.
            this.employeeRegistrationAuth = existingApp
                ? getAuth(existingApp)
                : initializeAuth(
                    initializeApp(firebaseConfig, appName),
                    {
                        persistence: inMemoryPersistence,
                        popupRedirectResolver: browserPopupRedirectResolver
                    }
                );
        }

        return this.employeeRegistrationAuth;
    }
}