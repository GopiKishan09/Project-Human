# Add project specific ProGuard rules here.
# By default, the active rules are in the Android SDK's proguard-android-optimize.txt.

-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep Android Browser Helper and Custom Tabs classes
-keep class androidx.browser.customtabs.** { *; }
-keep class com.google.androidbrowserhelper.** { *; }
