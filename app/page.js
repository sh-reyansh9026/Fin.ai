import HeroSection from "../components/hero";
import { howItWorksData, statsData, testimonialsData } from "@/data/landing";
import { featuresData } from "@/data/landing";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  
  return (
    <div className="mt-40">
      <HeroSection />
      <section className="py-20 bg-blue-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {statsData.map((statsData, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">{statsData.value}</div>
                <div className="text-gray-600">{statsData.label}</div>
                </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
  <div className="container mx-auto px-4">
    <h2 className="text-3xl font-bold text-center mb-12">
      Everything you need to manage your finances
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-center max-w-5xl mx-auto">
      {featuresData.map((feature, index) => (
        <div
          key={index}
          className="group relative bg-white border border-gray-200 rounded-xl shadow-md hover:shadow-lg overflow-hidden transition-all duration-300 px-6 pt-6 flex flex-col items-center text-center h-[150px] hover:h-[180px] max-w-[250px] mx-auto"
        >
          <div className="text-blue-600 text-4xl pb-2">
            {feature.icon}
          </div>
          <h3 className="text-lg font-semibold pt-2">{feature.title}</h3>
          <p className="text-gray-600 text-sm opacity-0 group-hover:opacity-100 transition-opacity mt-2 duration-300">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  </div>
</section>


<section className="py-20 bg-blue-50">
  <div className="container mx-auto px-4">
    <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>
    <div className="flex flex-col md:flex-row items-center justify-between gap-8 mx-8">
      {howItWorksData.map((step, index) => (
        <div
          key={index}
          className="bg-white shadow-md rounded-xl px-6 py-8 text-center w-full max-w-sm relative"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 font-bold text-lg">
            {index + 1}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {step.title}
          </h3>
          <p className="text-gray-600 text-sm">{step.description}</p>

          {/* Arrow (for desktop view only and not the last item) */}
          {index < howItWorksData.length - 1 && (
            <div className="hidden md:block absolute right-[-88px] top-1/2 transform -translate-y-1/2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 text-blue-500 stroke-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
</section>



      <section className="py-20 bg-blue-50 overflow-hidden">
  <div className="container mx-auto px-4">
    <h2 className="text-3xl font-bold text-center mb-12">
      What Our Users Say
    </h2>

    <div className="relative group">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] space-x-6">
        {testimonialsData.map((testimonial, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-xl shadow-md p-6 min-w-[300px] max-w-sm"
          >
            <div className="flex items-center mb-4">
              <Image
                src={testimonial.image}
                alt={testimonial.name}
                width={60}
                height={60}
                className="rounded-full"
              />
              <div className="ml-4">
                <div className="font-semibold">{testimonial.name}</div>
                <div className="text-gray-600 text-sm">{testimonial.role}</div>
              </div>
            </div>
            <p className="text-gray-600 text-sm">{testimonial.quote}</p>
          </div>
        ))}

        {/* Repeat the testimonials to create infinite loop effect */}
        {testimonialsData.map((testimonial, index) => (
          <div
            key={`repeat-${index}`}
            className="bg-white border border-gray-200 rounded-xl shadow-md p-6 min-w-[300px] max-w-sm"
          >
            <div className="flex items-center mb-4">
              <Image
                src={testimonial.image}
                alt={testimonial.name}
                width={60}
                height={60}
                className="rounded-full"
              />
              <div className="ml-4">
                <div className="font-semibold">{testimonial.name}</div>
                <div className="text-gray-600 text-sm">{testimonial.role}</div>
              </div>
            </div>
            <p className="text-gray-600 text-sm">{testimonial.quote}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
</section>


      <section className="py-20 bg-blue-950">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to take control of your finances?
          </h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            {" "}
            Join thousands of users who are already managing their finances smarter with Ai-Finance.
          </p>
          <Link href="/dashboard">
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-blue-50 animate-bounce"
            >
              Start Free Trial
            </Button>
          </Link>
          
        </div>

      </section>
  </div>
  )
}
